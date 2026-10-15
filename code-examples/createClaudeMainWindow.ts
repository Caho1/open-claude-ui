/**
 * 维度四：macOS 桌面深度融合与窗口材质物理学
 * 
 * 核心特性：
 * 1. BaseWindow / BrowserWindow + WebContentsView 双层解耦架构
 * 2. 8px 窗口化动态圆角裁切，全屏/最大化收缩为 0px
 * 3. 红绿灯中心对齐逆缩放补偿算法 Math.round((16.5 + 6) * zoom - 6)
 * 4. 子视图 100% 透明穿透与原生主题即时底色
 */

import { BrowserWindow, WebContentsView, nativeTheme } from 'electron';
import path from 'path';

const TRAFFIC_LIGHT_DIAMETER = 12; // fBn: 12px 标准按钮直径
const TRAFFIC_LIGHT_BASELINE = 16.5; // gBn: 33 / 2, 标准 45px 顶栏下的物理中心基准线

// 核心红绿灯缩放几何补偿算法
function getCompensatedTrafficLightPosition(zoomFactor: number) {
  const radius = TRAFFIC_LIGHT_DIAMETER / 2; // 6px
  const calc = (pos: number) => Math.max(0, Math.round((pos + radius) * zoomFactor - radius));
  return {
    x: calc(TRAFFIC_LIGHT_BASELINE),
    y: calc(TRAFFIC_LIGHT_BASELINE)
  };
}

export function createClaudeMainWindow() {
  const isDark = nativeTheme.shouldUseDarkColors;

  // 1. 实例化主宿主窗口
  const hostWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    trafficLightPosition: getCompensatedTrafficLightPosition(1),
    // 原生主题即时着色，彻底消除白闪
    backgroundColor: isDark ? '#151515' : '#fcfcfb',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'mainWindow.js')
    }
  });

  // 2. 实例化子视图 WebContentsView 并彻底透明化
  const contentView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'mainView.js'),
      sandbox: true,
      contextIsolation: true
    }
  });

  contentView.setBackgroundColor('#00000000'); // 100% 透明穿透
  hostWindow.contentView.addChildView(contentView);

  // 3. 布局同步与圆角物理状态机
  const updateBounds = () => {
    const bounds = hostWindow.getContentBounds();
    contentView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  };

  const updateRadius = () => {
    // 窗口化赋予 8px 圆角，最大化或全屏时收缩为 0px，防止黑色锯齿边缘溢出
    (contentView as any).setBorderRadius(
      hostWindow.isMaximized() || hostWindow.isFullScreen() ? 0 : 8
    );
  };

  hostWindow.on('resize', updateBounds);
  hostWindow.on('maximize', () => { updateBounds(); updateRadius(); });
  hostWindow.on('unmaximize', () => { updateBounds(); updateRadius(); });
  hostWindow.on('enter-full-screen', () => { updateBounds(); updateRadius(); });
  hostWindow.on('leave-full-screen', () => { updateBounds(); updateRadius(); });

  // 4. 监听缩放并动态补偿原生交通灯物理坐标
  contentView.webContents.on('zoom-changed', () => {
    const zoom = contentView.webContents.zoomFactor;
    hostWindow.setWindowButtonPosition(getCompensatedTrafficLightPosition(zoom));
  });

  hostWindow.once('ready-to-show', () => {
    updateBounds();
    updateRadius();
    hostWindow.show();
  });

  return hostWindow;
}
