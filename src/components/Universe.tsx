import { useEffect, useRef } from 'react';
import { VOIDS } from '../data';
import type { Entry, Link, VoidId } from '../types';

/**
 * 2D 宇宙画布：七空星系 + 星尘 + 关系线。
 * 第 6 轮将重建为 Three.js 3D 宇宙（星尘可点击、银河系可拖拽）；
 * 当前为数据可视化过渡版。
 */
export default function Universe({ entries, links }: { entries: Entry[]; links: Link[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#070b1c';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const pos = {} as Record<VoidId, { x: number; y: number }>;
      VOIDS.forEach((v, i) => {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        pos[v.id] = {
          x: rect.width / 2 + Math.cos(a) * Math.min(rect.width, rect.height) * 0.32,
          y: rect.height / 2 + Math.sin(a) * Math.min(rect.width, rect.height) * 0.32,
        };
      });

      links.forEach(l => {
        const a = entries.find(e => e.id === l.sourceId);
        const b = entries.find(e => e.id === l.targetId);
        if (a && b) {
          const pa = pos[a.primaryVoid];
          const pb = pos[b.primaryVoid];
          ctx.strokeStyle = 'rgba(160,185,255,.25)';
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      });

      VOIDS.forEach(v => {
        const p = pos[v.id];
        const group = entries.filter(e => e.primaryVoid === v.id);
        const g = ctx.createRadialGradient(p.x, p.y, 3, p.x, p.y, 72);
        g.addColorStop(0, v.color + 'cc');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 72, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#eaf0ff';
        ctx.font = '13px sans-serif';
        ctx.fillText(v.symbol + ' ' + v.name + ' · ' + group.length, p.x - 36, p.y - 83);
        group.slice(0, 40).forEach((e, j) => {
          const a = j * 2.4 + Date.now() / 6000;
          const rad = 22 + (j % 6) * 7;
          ctx.fillStyle = e.encoding?.color?.hex || v.color;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad, 3 + (j % 3), 0, 7);
          ctx.fill();
        });
      });

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [entries, links]);

  return <canvas className="universe" ref={ref} />;
}
