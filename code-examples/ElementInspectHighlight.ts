/**
 * Open Claude UI — Element Inspect Highlight（元素选择 / 组件名标签覆盖层）
 *
 * 取证来源：Claude Desktop `@ant/desktop 4.16336.0`
 *   `app.asar/.vite/build/index.chunk-Du-Wqi0E.js` @ 4726307..4736046
 *   注入脚本 `__inspectHighlight` / `aLi`（见 docs/v4.16336.0/01-…md §5）
 *
 * 这是一个 **headless / Pure Logic** 模块：不依赖 React、不依赖宿主页面的 CSS，
 * 通过 closed shadow root + top-layer popover 注入到任意第三方页面，因此不会
 * 被页面样式污染，也不会污染页面样式。
 *
 * 与官方实现一致的三条物理定律：
 *   1. 几何位移（left/top/width/height）：180ms `cubic-bezier(0.16, 1, 0.3, 1)`
 *      —— 即本项目 `--cds-ease-swift`，无过冲的 easeOutExpo。
 *   2. 绘制属性（background / border-color / opacity）：200ms ease-out。
 *   3. 退场（不参与下一次 morph 的 box）：opacity 160ms ease-out，180ms 后移除节点。
 *
 * 关键手感来自 **节点复用**：新选中的框会接管「刚刚悬停的框」的 DOM 节点，
 * 于是 CSS transition 能从旧位置连续插值到新位置，而不是 fade-out + fade-in。
 * 官方 `prefers-reduced-motion: reduce` 下全部 transition / animation 归零。
 */

/** 一个高亮矩形。`key` 是稳定身份；相同 key 的两次 update 会走 morph 而不是重建。 */
export interface InspectBox {
  key: string;
  /** 视口坐标（CSS px，不含 visualViewport offset） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 名称标签文本，官方由 `formatElementLabel()` 生成 */
  label: string;
  /** 已被点选（已添加到对话） */
  picked?: boolean;
  /** 悬停框的「幽灵副本」指向被点选框的 key，用于 cursor → picked 的连续过渡 */
  ghostOf?: string;
}

export interface InspectHighlightUpdate {
  boxes: InspectBox[];
  /** false / 首次绘制时不做几何插值 */
  animate?: boolean;
  /** 到期自动 hide()（官方 picked highlight 为 4000ms） */
  expiresInMs?: number;
}

export interface InspectHighlightOptions {
  /** 宿主文档，默认当前 document；跨 iframe 时传入对应 contentDocument */
  doc?: Document;
  /** 主题令牌查找根，默认 documentElement（自动继承 .dark） */
  tokenRoot?: Element;
  /** 自定义标记属性，默认 data-claude-inspect-highlight */
  hostAttribute?: string;
}

interface InspectItem {
  outline: HTMLElement;
  label: HTMLElement;
  box: InspectBox;
}

interface InspectState {
  host: HTMLElement;
  layer: HTMLElement;
  items: Map<string, InspectItem>;
  timer: number | undefined;
  disposed: boolean;
}

const DEFAULT_HOST_ATTRIBUTE = 'data-claude-inspect-highlight';

/** 官方 `rLi()`：tagName + (#id 优先，否则首个 class)，最长 64 字符。 */
export function formatElementLabel(nodeName: string, attributes: ArrayLike<string> = []): string {
  const get = (name: string): string => {
    for (let i = 0; i + 1 < attributes.length; i += 2) {
      if (attributes[i] === name) return (attributes[i + 1] ?? '').trim();
    }
    return '';
  };
  const id = get('id');
  const firstClass = get('class').split(/\s+/)[0] || '';
  const suffix = id ? `#${id}` : firstClass ? `.${firstClass}` : '';
  return `${nodeName.toLowerCase()}${suffix}`.slice(0, 64);
}

/** all: initial 的样式全部以 !important 写入，防止被页面 CSS 覆盖。 */
function important(el: HTMLElement, styles: Record<string, string>): void {
  for (const name of Object.keys(styles)) {
    el.style.setProperty(name, styles[name], 'important');
  }
}

/**
 * 解析 CDS 令牌；令牌缺失时回退到官方注入脚本里的硬编码值。
 * 官方因为要注入第三方页面所以直接写死 HEX；本实现优先走语义令牌，
 * 因此天然跟随 light / dark 主题切换。
 */
function token(root: Element | undefined, name: string, fallback: string): string {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  if (!el || typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

export class ElementInspectHighlight {
  private readonly doc: Document;
  private readonly tokenRoot: Element | undefined;
  private readonly hostAttribute: string;
  private state: InspectState | null = null;

  private readonly orange300: string;
  private readonly orange400: string;
  private readonly easeSwift: string;
  private readonly easePaint: string;

  constructor(options: InspectHighlightOptions = {}) {
    this.doc = options.doc ?? document;
    this.tokenRoot = options.tokenRoot ?? this.doc.documentElement;
    this.hostAttribute = options.hostAttribute ?? DEFAULT_HOST_ATTRIBUTE;
    this.orange300 = token(this.tokenRoot, '--cds-orange-300', '#ec835a');
    this.orange400 = token(this.tokenRoot, '--cds-orange-400', '#d95926');
    this.easeSwift = token(this.tokenRoot, '--cds-ease-swift', 'cubic-bezier(0.16, 1, 0.3, 1)');
    // 官方使用关键字 ease-out；本项目收敛到校准过的等效曲线（无线性、无过冲）。
    this.easePaint = 'cubic-bezier(0, 0, .2, 1)';
  }

  /** alpha 合成：官方 `rgba(236, 131, 90, α)`，这里用令牌色 + color-mix 保持单一色源。 */
  private orange(alpha: number): string {
    return `color-mix(in srgb, ${this.orange300} ${Math.round(alpha * 100)}%, transparent)`;
  }

  private reducedMotion(): boolean {
    const view = this.doc.defaultView;
    return !!view && typeof view.matchMedia === 'function'
      && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private makeEl(): HTMLElement {
    const el = this.doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
    el.setAttribute(this.hostAttribute, '');
    return el;
  }

  private ensureState(): InspectState {
    if (this.state && !this.state.disposed) return this.state;

    const host = this.makeEl();
    host.setAttribute('aria-hidden', 'true');
    // Top layer：压过页面里后弹出的 <dialog> / [popover]。浏览器不支持时静默降级。
    const popoverHost = host as HTMLElement & { popover?: string; showPopover?: () => void };
    if ('popover' in popoverHost) popoverHost.popover = 'manual';
    important(host, {
      all: 'initial',
      display: 'block',
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
      overflow: 'hidden',
      'pointer-events': 'none',
      'z-index': '2147483647',
    });

    const layer = this.makeEl();
    important(layer, { display: 'contents' });
    // closed shadow root：页面脚本拿不到内部节点，标注层不可能被页面改样式或误点。
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.append(layer);

    this.state = { host, layer, items: new Map(), timer: undefined, disposed: false };
    return this.state;
  }

  /**
   * 绘制/更新全部高亮框。同一个 key 复用同一对 DOM 节点 —— 这是「切换组件时
   * 丝滑」的根本原因：几何属性在已有元素上变化，浏览器直接跑 transition。
   */
  update(update: InspectHighlightUpdate): void {
    const state = this.ensureState();
    const view = this.doc.defaultView;
    if (state.timer !== undefined) {
      view?.clearTimeout(state.timer);
      state.timer = undefined;
    }

    const boxes = update.boxes;
    if (boxes.length === 0) {
      this.hide();
      return;
    }

    const offsetX = view?.visualViewport?.offsetLeft ?? 0;
    const offsetY = view?.visualViewport?.offsetTop ?? 0;
    const reduced = this.reducedMotion();
    const keep = new Set(boxes.map((b) => b.key));
    const cursorPick = boxes.find((b) => b.ghostOf)?.ghostOf;

    // 标签必须先进入文档才能测量 offsetWidth，否则 left 夹取会失效。
    let added = false;
    if (!state.host.isConnected) {
      this.doc.documentElement.appendChild(state.host);
      added = true;
    }
    const edge = Math.min(
      state.host.clientWidth,
      offsetX + (view?.visualViewport?.width ?? Number.POSITIVE_INFINITY),
    );

    for (const box of boxes) {
      // 新 pick 优先接管「点下时鼠标下方的悬停框」，其次接管任何即将消失的框。
      if (box.picked && !state.items.has(box.key)) {
        const cursor = state.items.get('cursor');
        const under = !!cursor && !cursor.box.ghostOf && cursorPick === box.key
          && (['x', 'y', 'width', 'height'] as const).every((side) => cursor.box[side] === box[side]);
        const from = under
          ? 'cursor'
          : Array.from(state.items.keys()).find((key) => !keep.has(key));
        if (from) {
          const reused = state.items.get(from);
          if (reused) {
            state.items.set(box.key, reused);
            state.items.delete(from);
          }
        }
      }

      let item = state.items.get(box.key);
      const fresh = !item;
      if (!item) {
        const outline = this.makeEl();
        const label = this.makeEl();
        important(outline, {
          position: 'absolute',
          'box-sizing': 'border-box',
          'border-radius': '4px',
        });
        important(label, {
          position: 'absolute',
          'box-sizing': 'border-box',
          'max-width': '240px',
          height: '18px',
          padding: '0 6px',
          'border-radius': '4px',
          background: this.orange400,
          color: '#ffffff',
          font: '500 11px/18px system-ui, sans-serif',
          'white-space': 'nowrap',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
        });
        state.layer.append(outline, label);
        item = { outline, label, box };
        state.items.set(box.key, item);
        added = true;
      }

      const geometry = (properties: string[]): string => {
        if (reduced) return 'none';
        const parts: string[] = [];
        if (update.animate && !fresh) {
          for (const p of properties) parts.push(`${p} 180ms ${this.easeSwift}`);
        }
        for (const p of ['background', 'border-color', 'opacity']) {
          parts.push(`${p} 200ms ${this.easePaint}`);
        }
        return parts.join(', ');
      };

      const opacity = box.ghostOf ? '0' : '1';
      const y = box.y + offsetY;
      item.box = box;

      important(item.outline, {
        transition: geometry(['left', 'top', 'width', 'height']),
        border: `1px solid ${this.orange(box.picked ? 0.9 : 0.55)}`,
        background: this.orange(box.picked ? 0.16 : 0.06),
        opacity,
        left: `${box.x + offsetX}px`,
        top: `${y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      important(item.label, {
        transition: geometry(['left', 'top']),
        opacity,
        // 上方空间足够时贴在框上方 20px；否则贴到框内顶部 2px，避免被视口裁掉。
        top: `${y >= 20 ? y - 20 : Math.max(0, y) + 2}px`,
      });
      item.label.textContent = box.label;

      const x = box.x + offsetX;
      const room = x < edge ? edge - item.label.offsetWidth : x;
      important(item.label, { left: `${Math.max(0, Math.min(x, room))}px` });
    }

    // 退场：先 160ms 淡出，180ms 后再移除节点（给过渡留完整一帧）。
    for (const key of Array.from(state.items.keys())) {
      if (keep.has(key)) continue;
      const gone = state.items.get(key);
      if (!gone) continue;
      state.items.delete(key);
      const remove = (): void => { gone.outline.remove(); gone.label.remove(); };
      if (reduced) { remove(); continue; }
      important(gone.outline, { transition: `opacity 160ms ${this.easePaint}`, opacity: '0' });
      important(gone.label, { transition: `opacity 160ms ${this.easePaint}`, opacity: '0' });
      view?.setTimeout(remove, 180);
    }

    // 重新进入 top layer：压住本次绘制之后才打开的 modal。
    const popoverHost = state.host as HTMLElement & {
      matches?: (s: string) => boolean;
      hidePopover?: () => void;
      showPopover?: () => void;
    };
    let needsTopLayer = added;
    if (!needsTopLayer) {
      try {
        needsTopLayer = !!this.doc.querySelector(
          `dialog:modal, [popover]:popover-open:not([${this.hostAttribute}])`,
        );
      } catch { needsTopLayer = false; /* 老引擎不支持 :popover-open */ }
    }
    if (needsTopLayer) {
      try {
        if (popoverHost.matches?.(':popover-open')) popoverHost.hidePopover?.();
        popoverHost.showPopover?.();
      } catch { /* 页面可能已卸载 */ }
    }

    if (update.expiresInMs) {
      state.timer = view?.setTimeout(() => this.hide(), update.expiresInMs);
    }
  }

  /** 截图前隐藏、截图后恢复：官方 `sLi` / `cLi` 用两个 rAF 保证隐藏已提交。 */
  setLayerVisible(visible: boolean): void {
    if (!this.state) return;
    important(this.state.layer, { visibility: visible ? 'visible' : 'hidden' });
  }

  /** 完全移除覆盖层并释放所有节点。 */
  hide(): void {
    const state = this.state;
    if (!state) return;
    const view = this.doc.defaultView;
    if (state.timer !== undefined) view?.clearTimeout(state.timer);
    state.host.remove();
    for (const item of state.items.values()) {
      item.outline.remove();
      item.label.remove();
    }
    state.items.clear();
    state.disposed = true;
    this.state = null;
  }
}

/**
 * 浏览器侧的 React 组件名反射（等价于官方 `yLi` 的 name/owners/props 部分）。
 *
 * 取证：app.asar/.vite/build/index.chunk-Du-Wqi0E.js
 *   `4,737,899` usefulName / `4,738,185` typeName / `4,738,735` componentName
 *   `4,739,208` memoWrapperOf / `4,739,588` ownerNames / `4,740,233` summarizeProp
 *   `4,751,679` 主体（找 __reactFiber$ → 沿 return 上溯 → memo/alternate → 组装）
 *
 * 官方是在主进程用 CDP `Runtime.callFunctionOn` 把这段逻辑注入页面执行的；
 * 这里给出纯前端等价实现，供宿主直接调用。sourcemap 反查（VLQ 解码 + 同源
 * fetch inline map）属于宿主能力，本模块不复刻。
 *
 * 与官方一致：所有字段读取都过 try/catch（页面对象可能有抛异常的 getter 或
 * 已撤销的 Proxy），单个坏字段只损失该字段，不影响整体结果。
 */
export interface ReactComponentInfo {
  name: string;
  /** 最近优先的 owner 链，最多 4 个（官方 MAX_OWNERS） */
  owners: string[];
  props: Record<string, string | number | boolean | null>;
}

const COMPONENT_TAGS: Record<number, true> = { 0: true, 1: true, 11: true, 14: true, 15: true };
const MEMO_TAG = 14;
const MAX_FIBERS = 5000;
const MAX_OWNERS = 4;
const MAX_PROPS = 50;
const MAX_STRING = 200;
const MAX_NAME = 100;

function safe<T>(read: () => T, fallback: T): T {
  try { return read(); } catch { return fallback; }
}
function fld(obj: unknown, key: string): unknown {
  return safe(() => (obj == null ? undefined : (obj as Record<string, unknown>)[key]), undefined);
}

/** 过滤 Anonymous 与 react-refresh 注册的 `_cN` 匿名组件。 */
function usefulName(n: unknown): string | null {
  return typeof n === 'string' && n.length > 1 && n !== 'Anonymous' && !/^_c\d*$/.test(n)
    ? n.slice(0, MAX_NAME)
    : null;
}

/** displayName > name；forwardRef 的 {render} 与 memo 的 {type} 递归解包。 */
function typeName(type: unknown, depth = 0): string | null {
  if (!type || depth > 3) return null;
  const named = (k: string): string | null => usefulName(fld(type, k));
  if (typeof type === 'function') return named('displayName') || named('name');
  if (typeof type === 'object') {
    return named('displayName')
      || typeName(fld(type, 'render'), depth + 1)
      || typeName(fld(type, 'type'), depth + 1);
  }
  return null;
}

function componentName(fiber: unknown): string | null {
  const tag = fld(fiber, 'tag');
  return typeof tag === 'number' && COMPONENT_TAGS[tag] === true
    ? typeName(fld(fiber, 'elementType')) || typeName(fld(fiber, 'type'))
    : null;
}

/** 带 comparator 的 memo() 会多一层 Memo Fiber，JSX 调用点在 wrapper 上。 */
function memoWrapperOf(fiber: unknown): unknown {
  const wrapper = fld(fiber, 'return');
  return wrapper && fld(wrapper, 'tag') === MEMO_TAG
    && fld(fld(wrapper, 'type'), 'type') === fld(fiber, 'type')
    ? wrapper : null;
}

/** `_debugOwner` 链（不是 fiber tree 的父链）；兼容 React 19 的 {name, owner}。 */
function ownerNames(fiber: unknown): string[] {
  const names: string[] = [];
  let owner: unknown = fld(fiber, '_debugOwner');
  for (let guard = 0; owner && names.length < MAX_OWNERS && guard < 64; guard++) {
    const isFiber = typeof fld(owner, 'tag') === 'number';
    const n = isFiber
      ? typeName(fld(owner, 'elementType')) || typeName(fld(owner, 'type'))
      : usefulName(fld(owner, 'name'));
    if (n && names[names.length - 1] !== n) names.push(n);
    owner = isFiber ? fld(owner, '_debugOwner') : fld(owner, 'owner');
  }
  return names;
}

function summarizeProp(v: unknown): string | number | boolean | null | undefined {
  const t = typeof v;
  if (v === null || t === 'number' || t === 'boolean') return v as number | boolean | null;
  if (t === 'string') {
    const s = v as string;
    return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}\u2026` : s;
  }
  if (t === 'function') return '[function]';
  if (t === 'undefined') return undefined;
  if (Array.isArray(v)) return `[array(${v.length})]`;
  if (t === 'object') return (v as { $$typeof?: unknown }).$$typeof ? '[element]' : '[object]';
  return `[${t}]`;
}

function summarizeProps(props: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  const keys = safe(() => (props ? Object.keys(props as object) : []), [] as string[]);
  let count = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === 'children' || k === 'ref' || k === '__proto__') continue;
    if (count === MAX_PROPS) {
      const left = keys.slice(i).filter((j) => j !== 'children' && j !== 'ref' && j !== '__proto__').length;
      out['...'] = `[+${left} more]`;
      break;
    }
    const v = safe(
      () => summarizeProp((props as Record<string, unknown>)[k]),
      '[unreadable]' as string | number | boolean | null | undefined,
    );
    if (v === undefined) continue;
    out[k.slice(0, MAX_NAME)] = v;
    count++;
  }
  return out;
}

export function readReactComponentName(element: Element): ReactComponentInfo | null {
  if (typeof element === 'undefined' || element === null) return null;
  const key = safe(
    () => Object.keys(element).find(
      (k) => k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0,
    ),
    undefined as string | undefined,
  );
  if (!key) return null;

  let fiber: unknown = fld(element, key);
  let name = componentName(fiber);
  for (let depth = 0; fiber && !name && depth < MAX_FIBERS; depth++) {
    fiber = fld(fiber, 'return');
    name = componentName(fiber);
  }
  if (!name) return null;

  // memo 对：命名以 wrapper 为准（官方同时把两棵 Fiber 及其 alternate 记为「自己」，
  // 那部分只用于 JSX 源码定位，本模块不做 sourcemap 反查，故省略）。
  const wrapper = memoWrapperOf(fiber);
  if (wrapper) {
    fiber = wrapper;
    name = componentName(wrapper) || name;
  }

  return {
    name,
    owners: safe(() => ownerNames(fiber), [] as string[]),
    props: safe(() => summarizeProps(fld(fiber, 'memoizedProps')), {}),
  };
}

export default ElementInspectHighlight;
