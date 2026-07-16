import { useEffect, useRef, useState } from 'react';

/**
 * Measures its own width and hands explicit pixel dimensions to a recharts
 * chart via a render prop: <ChartFrame>{(w, h) => <PieChart width={w} height={h}/>}</ChartFrame>.
 *
 * Works around recharts 3.x <ResponsiveContainer> measuring width 0 on first
 * mount with React 19 (charts render blank until a window resize).
 */
export function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      setWidth((prev) => (prev === next ? prev : next)); // ignore sub-pixel jitter
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default function ChartFrame({ height = 240, children }) {
  const [ref, width] = useContainerWidth();
  return (
    <div ref={ref} style={{ width: '100%', minHeight: height }}>
      {width > 0 ? children(Math.max(0, Math.floor(width)), height) : null}
    </div>
  );
}
