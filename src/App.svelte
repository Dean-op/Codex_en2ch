<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowLeftRight,
    Check,
    Clipboard,
    Copy,
    Eye,
    EyeOff,
    Keyboard,
    LoaderCircle,
    PanelRightOpen,
    SendHorizontal,
    Settings,
    ShieldCheck,
    X
  } from 'lucide-svelte';
  import { copyText, readClipboardText, translate, type TranslationConfig } from './lib/bridge';

  type View = 'compose' | 'reader' | 'settings';
  type NoticeTone = 'success' | 'error' | 'neutral';
  type Notice = { tone: NoticeTone; text: string } | null;

  const defaults: TranslationConfig = {
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4.1-mini',
    timeoutSeconds: 45
  };

  let view: View = 'compose';
  let prompt = '';
  let promptOutput = '';
  let copiedSource = '';
  let readerOutput = '';
  let apiKey = '';
  let config = { ...defaults };
  let inFlight: 'prompt' | 'reader' | null = null;
  let showKey = false;
  let notice: Notice = null;
  let lastOutputLabel = '等待翻译';

  onMount(() => {
    const stored = localStorage.getItem('codex-zh-bridge.config');
    if (!stored) return;
    try {
      config = { ...defaults, ...JSON.parse(stored) };
    } catch {
      localStorage.removeItem('codex-zh-bridge.config');
    }
  });

  function announce(text: string, tone: NoticeTone = 'neutral') {
    notice = { text, tone };
  }

  function requireService() {
    if (config.baseUrl.trim() && config.model.trim() && apiKey.trim()) return true;
    view = 'settings';
    announce('请先填写翻译服务配置与 API Key。', 'error');
    return false;
  }

  async function translatePrompt() {
    if (!prompt.trim() || !requireService()) return;
    inFlight = 'prompt';
    try {
      promptOutput = await translate(prompt, 'zh-en', config, apiKey);
      lastOutputLabel = '英文提示词已就绪';
      announce('英文提示词已生成。', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : '翻译失败。', 'error');
    } finally {
      inFlight = null;
    }
  }

  async function translateReader() {
    if (!copiedSource.trim() || !requireService()) return;
    inFlight = 'reader';
    try {
      readerOutput = await translate(copiedSource, 'en-zh', config, apiKey);
      lastOutputLabel = '中文阅读结果';
      announce('中文结果已生成。', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : '翻译失败。', 'error');
    } finally {
      inFlight = null;
    }
  }

  async function loadClipboard() {
    try {
      copiedSource = await readClipboardText();
      announce('已载入剪贴板文本。', 'success');
    } catch {
      announce('无法读取剪贴板，请直接粘贴文本。', 'error');
    }
  }

  async function copyResult(text: string) {
    if (!text) return;
    try {
      await copyText(text);
      announce('已复制到剪贴板。', 'success');
    } catch {
      announce('复制失败。', 'error');
    }
  }

  function saveSettings() {
    localStorage.setItem('codex-zh-bridge.config', JSON.stringify(config));
    announce('偏好已保存。API Key 仅保留在当前会话。', 'success');
    view = 'compose';
  }

  function handlePromptKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      translatePrompt();
    }
  }
</script>

<svelte:head>
  <meta name="description" content="Codex 中文桥翻译工作台" />
</svelte:head>

<main class="app-shell">
  <aside class="sidebar" aria-label="主导航">
    <div class="brand">
      <div class="brand-mark">C</div>
      <div>
        <strong>Codex 中文桥</strong>
        <span>V1 工作台</span>
      </div>
    </div>

    <nav>
      <button class:active={view === 'compose'} on:click={() => view = 'compose'}>
        <SendHorizontal size={17} />
        <span>输入翻译</span>
      </button>
      <button class:active={view === 'reader'} on:click={() => view = 'reader'}>
        <PanelRightOpen size={17} />
        <span>回答阅读</span>
      </button>
      <button class:active={view === 'settings'} on:click={() => view = 'settings'}>
        <Settings size={17} />
        <span>连接设置</span>
      </button>
    </nav>

    <div class="target-status">
      <span class="indicator"></span>
      <div>
        <strong>Codex Desktop</strong>
        <small>原生连接待启用</small>
      </div>
    </div>
  </aside>

  <section class="workspace">
    <header class="topbar">
      <div>
        <p class="eyebrow">{view === 'compose' ? 'PROMPT COMPOSER' : view === 'reader' ? 'RESPONSE READER' : 'CONNECTION'}</p>
        <h1>{view === 'compose' ? '中文输入' : view === 'reader' ? '回答阅读' : '翻译服务'}</h1>
      </div>
      <div class="privacy-badge"><ShieldCheck size={16} /> 内容不保留</div>
    </header>

    {#if notice}
      <div class:success={notice.tone === 'success'} class:error={notice.tone === 'error'} class="notice" role="status">
        <span>{notice.text}</span>
        <button title="关闭通知" aria-label="关闭通知" on:click={() => notice = null}><X size={15} /></button>
      </div>
    {/if}

    {#if view === 'compose'}
      <div class="work-grid">
        <section class="surface composer">
          <div class="surface-header">
            <div>
              <h2>中文需求</h2>
              <p>保留代码、链接、路径与公式</p>
            </div>
            <div class="shortcut"><Keyboard size={14} /> Ctrl + Enter</div>
          </div>
          <textarea bind:value={prompt} on:keydown={handlePromptKeydown} placeholder="描述你希望 Codex 完成的工作..." aria-label="中文需求"></textarea>
          <footer>
            <span>{prompt.length} 字符</span>
            <button class="primary" disabled={inFlight === 'prompt' || !prompt.trim()} on:click={translatePrompt}>
              {#if inFlight === 'prompt'}<LoaderCircle class="spin" size={17} />{:else}<ArrowLeftRight size={17} />{/if}
              <span>翻译为英文</span>
            </button>
          </footer>
        </section>

        <section class="surface output" class:empty={!promptOutput}>
          <div class="surface-header">
            <div>
              <h2>{lastOutputLabel}</h2>
              <p>确认后复制到 Codex 输入框</p>
            </div>
            <button class="icon-button" title="复制英文" aria-label="复制英文" disabled={!promptOutput} on:click={() => copyResult(promptOutput)}><Copy size={17} /></button>
          </div>
          {#if promptOutput}
            <pre>{promptOutput}</pre>
          {:else}
            <div class="empty-state">翻译结果会显示在这里。</div>
          {/if}
        </section>
      </div>
    {:else if view === 'reader'}
      <div class="work-grid reader-grid">
        <section class="surface composer">
          <div class="surface-header">
            <div>
              <h2>英文原文</h2>
              <p>载入从 Codex 复制的回答</p>
            </div>
            <button class="compact-button" on:click={loadClipboard}><Clipboard size={15} /> 载入剪贴板</button>
          </div>
          <textarea bind:value={copiedSource} placeholder="粘贴 Codex 的英文回答..." aria-label="英文原文"></textarea>
          <footer>
            <span>{copiedSource.length} 字符</span>
            <button class="primary" disabled={inFlight === 'reader' || !copiedSource.trim()} on:click={translateReader}>
              {#if inFlight === 'reader'}<LoaderCircle class="spin" size={17} />{:else}<ArrowLeftRight size={17} />{/if}
              <span>翻译为中文</span>
            </button>
          </footer>
        </section>

        <section class="surface output" class:empty={!readerOutput}>
          <div class="surface-header">
            <div>
              <h2>中文结果</h2>
              <p>原 Markdown 结构保持不变</p>
            </div>
            <button class="icon-button" title="复制中文" aria-label="复制中文" disabled={!readerOutput} on:click={() => copyResult(readerOutput)}><Copy size={17} /></button>
          </div>
          {#if readerOutput}
            <pre>{readerOutput}</pre>
          {:else}
            <div class="empty-state">翻译后的中文回答会显示在这里。</div>
          {/if}
        </section>
      </div>
    {:else}
      <section class="settings-layout">
        <div class="settings-intro">
          <h2>OpenAI 兼容服务</h2>
          <p>发送请求前，应用会将 Markdown 拆成可翻译文本和不可变技术片段。</p>
        </div>
        <form class="settings-form" on:submit|preventDefault={saveSettings}>
          <label>
            <span>Base URL</span>
            <input bind:value={config.baseUrl} type="url" placeholder="https://api.openai.com" required />
          </label>
          <label>
            <span>Model</span>
            <input bind:value={config.model} placeholder="gpt-4.1-mini" required />
          </label>
          <label>
            <span>API Key</span>
            <div class="password-field">
              <input bind:value={apiKey} type={showKey ? 'text' : 'password'} placeholder="仅保留在当前会话" autocomplete="off" />
              <button type="button" class="icon-button" title={showKey ? '隐藏 API Key' : '显示 API Key'} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} on:click={() => showKey = !showKey}>
                {#if showKey}<EyeOff size={17} />{:else}<Eye size={17} />{/if}
              </button>
            </div>
          </label>
          <label>
            <span>请求超时（秒）</span>
            <input bind:value={config.timeoutSeconds} type="number" min="5" max="180" required />
          </label>
          <div class="settings-actions">
            <button type="submit" class="primary"><Check size={17} /> 保存连接设置</button>
          </div>
        </form>
      </section>
    {/if}
  </section>
</main>
