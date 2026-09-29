/**
 * Web 端的启动遮罩替身。
 *
 * 原生端有一个覆盖全屏的品牌启动动画(见 animated-icon.tsx),但 Web 上:
 *   · 没有原生启动页需要遮盖;
 *   · 那套动画素材是给移动端准备的,回落到 Web 上只会拖慢首屏。
 * 所以这里直接不渲染,保持行为与之前一致。
 */
export function AnimatedSplashOverlay() {
  return null;
}
