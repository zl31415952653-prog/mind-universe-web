import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { VOIDS, voidById } from '../data';
import { relationById } from '../relations';
import type { CandidateLink, Entry, Link as LinkItem, VoidDef, VoidId } from '../types';

/**
 * 3D 宇宙（第 6 轮）：宇宙 = 认知数据的实时面貌。
 * 七个银河系=七空域（可拖拽、位置持久化到 localStorage、点击聚焦）；
 * 星尘=经历（InstancedMesh 实例化，1000+ 流畅；色=色块编码或主空色；悬停显示卡片、点击进入详情）；
 * 连接线按八类关系区分颜色；虫洞=跨空高强度关系（旋转环）；超新星=灵感标记（脉冲星）；
 * 新星尘有诞生动画；宇宙随条目数缓慢膨胀；沉浸模式全屏可用。
 * 自实现轨道控制与星空（不引入 drei，保持依赖轻量）。
 */

// ---------- 工具 ----------

function hashNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function makeGlowTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color + 'ff');
  g.addColorStop(0.3, color + '88');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeTextTexture(title: string, sub: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(7,11,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 144, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(233,186,74,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f3f5ff';
  ctx.font = '600 44px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 72);
  ctx.fillStyle = '#9bc7ff';
  ctx.font = '32px "Microsoft YaHei", sans-serif';
  ctx.fillText(sub, 256, 126);
  return new THREE.CanvasTexture(c);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const STORAGE_KEY = 'infinity-galaxy-positions';
const BASE_POSITIONS: [number, number][] = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2;
  return [Math.cos(a) * 9.5, Math.sin(a) * 5.6] as [number, number];
});

function loadPositions(): [number, number][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as [number, number][];
      if (Array.isArray(parsed) && parsed.length === 7) return parsed;
    }
  } catch { /* ignore */ }
  return BASE_POSITIONS;
}

/** 星尘在星系内的确定性偏移（按条目 id 哈希，永不漂移） */
function nodeOffset(id: string): [number, number, number] {
  const h = hashNum(id);
  const angle = (h % 360) * (Math.PI / 180);
  const radius = 0.9 + ((h >> 8) % 100) / 100 * 3.6;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, (((h >> 16) % 100) / 100) * 1.8 - 0.9];
}

/** 轨道拖拽是否被星系拖动抑制（跨组件共享标志） */
const orbitSuppress = { current: false };

// ---------- 轨道控制（自实现：左键旋转、滚轮缩放、聚焦动画） ----------

function OrbitRig({ zoomTarget }: { zoomTarget: THREE.Vector3 | null }) {
  const { camera, gl } = useThree();
  const s = useRef({ theta: 0.6, phi: 1.12, radius: 32, target: new THREE.Vector3(0, 0, 0), dragging: false, lastX: 0, lastY: 0 });
  const anim = useRef<{ from: { target: THREE.Vector3; radius: number }; start: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      if (orbitSuppress.current) return;
      s.current.dragging = true;
      s.current.lastX = e.clientX;
      s.current.lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!s.current.dragging) return;
      const dx = e.clientX - s.current.lastX;
      const dy = e.clientY - s.current.lastY;
      s.current.lastX = e.clientX;
      s.current.lastY = e.clientY;
      s.current.theta -= dx * 0.005;
      s.current.phi = Math.max(0.25, Math.min(1.45, s.current.phi - dy * 0.005));
    };
    const up = () => { s.current.dragging = false; };
    const wheel = (e: WheelEvent) => {
      s.current.radius = Math.max(10, Math.min(64, s.current.radius + e.deltaY * 0.02));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useEffect(() => {
    anim.current = { from: { target: s.current.target.clone(), radius: s.current.radius }, start: performance.now() };
  }, [zoomTarget]);

  useFrame(() => {
    const st = s.current;
    if (anim.current) {
      const t = Math.min(1, (performance.now() - anim.current.start) / 800);
      const e = easeInOut(t);
      const to = zoomTarget ?? new THREE.Vector3(0, 0, 0);
      const toRadius = zoomTarget ? 15 : 32;
      st.target.lerpVectors(anim.current.from.target, to, e);
      st.radius = anim.current.from.radius + (toRadius - anim.current.from.radius) * e;
      if (t >= 1) anim.current = null;
    }
    const sinPhi = Math.sin(st.phi);
    camera.position.set(
      st.target.x + st.radius * sinPhi * Math.sin(st.theta),
      st.target.y + st.radius * Math.cos(st.phi),
      st.target.z + st.radius * sinPhi * Math.cos(st.theta)
    );
    camera.lookAt(st.target);
  });
  return null;
}

// ---------- 星空 ----------

function Starfield() {
  const geo = useMemo(() => {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 30 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.12} color="#9fb4e8" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ---------- 银河系（可拖拽、可聚焦） ----------

function Galaxy({ v, position, count, onMove, onTap }: {
  v: VoidDef;
  position: THREE.Vector3;
  count: number;
  onMove: (x: number, y: number) => void;
  onTap: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const glow = useMemo(() => makeGlowTexture(v.color), [v.color]);
  const label = useMemo(() => makeTextTexture(`${v.symbol} ${v.name}`, `${count} 颗星尘 · ${v.question}`), [v.symbol, v.name, count, v.question]);
  const { camera, size } = useThree();
  const dragging = useRef(false);
  const moved = useRef(0);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.25;
  });

  return (
    <group
      ref={ref}
      position={position}
      onPointerDown={e => {
        e.stopPropagation();
        dragging.current = true;
        moved.current = 0;
        orbitSuppress.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={e => {
        if (!dragging.current) return;
        const ndc = new THREE.Vector2(
          (e.nativeEvent.clientX / size.width) * 2 - 1,
          -((e.nativeEvent.clientY / size.height) * 2 - 1)
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const pt = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, pt)) {
          moved.current += Math.abs(pt.x - position.x) + Math.abs(pt.y - position.y);
          onMove(pt.x, pt.y);
        }
      }}
      onPointerUp={e => {
        if (!dragging.current) return;
        dragging.current = false;
        orbitSuppress.current = false;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        if (moved.current < 0.4) onTap();
      }}
    >
      <mesh>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshBasicMaterial color={v.color} transparent opacity={0.92} />
      </mesh>
      <sprite scale={[5, 5, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} />
      </sprite>
      <sprite position={[0, -2.1, 0]} scale={[4.4, 1.4, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

// ---------- 星尘（实例化渲染，悬停/点击） ----------

function Stardust({ entries, nodePositions, onHover, onOut, onClick }: {
  entries: Entry[];
  nodePositions: Map<string, THREE.Vector3>;
  onHover: (e: Entry | null, x?: number, y?: number) => void;
  onOut: () => void;
  onClick: (e: Entry) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const hovered = useRef<number | null>(null);

  useMemo(() => {
    hovered.current = null;
  }, [entries]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    entries.forEach((e, i) => {
      const p = nodePositions.get(e.id);
      if (!p) return;
      mat.makeTranslation(p.x, p.y, p.z);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, new THREE.Color(e.encoding?.color?.hex || voidById(e.primaryVoid).color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.count = entries.length;
  }, [entries, nodePositions]);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, entries.length] as unknown as [THREE.BufferGeometry, THREE.Material, number]}
      onPointerMove={e => {
        if (e.instanceId === undefined) return;
        hovered.current = e.instanceId;
        e.stopPropagation();
        onHover(entries[e.instanceId], e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
      onPointerOut={() => {
        hovered.current = null;
        onOut();
      }}
      onClick={e => {
        if (e.instanceId === undefined) return;
        if (e.delta > 8) return; // 拖拽旋转不算点击
        onClick(entries[e.instanceId]);
      }}
    >
      <sphereGeometry args={[0.1, 10, 10]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}

// ---------- 连接线（单次绘制所有线段，按关系类型着色） ----------

function LinkLines({ links, nodePositions }: { links: LinkItem[]; nodePositions: Map<string, THREE.Vector3> }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    for (const l of links) {
      const a = nodePositions.get(l.sourceId);
      const b = nodePositions.get(l.targetId);
      if (!a || !b) continue;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const c = new THREE.Color(relationById(l.relationType).color);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [links, nodePositions]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.5} />
    </lineSegments>
  );
}

// ---------- 虫洞（跨主空且强度 ≥0.7 的关系：旋转环） ----------

function Wormholes({ links, entries, nodePositions }: { links: LinkItem[]; entries: Entry[]; nodePositions: Map<string, THREE.Vector3> }) {
  const items = links.filter(l => {
    const a = entries.find(e => e.id === l.sourceId);
    const b = entries.find(e => e.id === l.targetId);
    return a && b && a.primaryVoid !== b.primaryVoid && l.strength >= 0.7;
  });
  return (
    <group>
      {items.map(l => {
        const a = nodePositions.get(l.sourceId);
        const b = nodePositions.get(l.targetId);
        if (!a || !b) return null;
        return <WormholeRing key={l.id} mid={new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)} />;
      })}
    </group>
  );
}

/** AI 候选边（金色虚线，确认前不进入正式关系） */
function AILinkLines({ links, nodePositions }: { links: CandidateLink[]; nodePositions: Map<string, THREE.Vector3> }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    for (const l of links) {
      const a = nodePositions.get(l.sourceId);
      const b = nodePositions.get(l.targetId);
      if (!a || !b) continue;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [links, nodePositions]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f3c969" transparent opacity={0.95} />
    </lineSegments>
  );
}

function WormholeRing({ mid }: { mid: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.z += dt * 2.2;
    ref.current.rotation.x += dt * 1.1;
  });
  return (
    <mesh ref={ref} position={mid}>
      <torusGeometry args={[0.34, 0.05, 8, 26]} />
      <meshBasicMaterial color="#f3c969" transparent opacity={0.9} />
    </mesh>
  );
}

// ---------- 超新星（灵感标记：脉冲星） ----------

function Supernovas({ entries, nodePositions, onClick }: {
  entries: Entry[];
  nodePositions: Map<string, THREE.Vector3>;
  onClick: (e: Entry) => void;
}) {
  return (
    <group>
      {entries.filter(e => e.insight).map(e => {
        const p = nodePositions.get(e.id);
        if (!p) return null;
        return <Supernova key={e.id} position={p} onClick={() => onClick(e)} />;
      })}
    </group>
  );
}

function Supernova({ position, onClick }: { position: THREE.Vector3; onClick: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => makeGlowTexture('#fff3c9'), []);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.25;
    if (ref.current) ref.current.scale.setScalar(s);
  });
  return (
    <group position={position} onClick={e => { if (e.delta > 8) return; onClick(); }}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#fff7d6" />
      </mesh>
      <sprite scale={[1.4, 1.4, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

// ---------- 新星尘诞生动画 ----------

function SpawnGlow({ entries, nodePositions }: { entries: Entry[]; nodePositions: Map<string, THREE.Vector3> }) {
  const prev = useRef<Set<string>>(new Set());
  const [spawns, setSpawns] = useState<{ id: string; pos: THREE.Vector3; born: number }[]>([]);

  useEffect(() => {
    const cur = new Set(entries.map(e => e.id));
    const fresh = entries
      .filter(e => !prev.current.has(e.id))
      .map(e => ({ id: e.id, pos: nodePositions.get(e.id), born: Date.now() }))
      .filter((x): x is { id: string; pos: THREE.Vector3; born: number } => !!x.pos);
    prev.current = cur;
    if (fresh.length > 0) {
      setSpawns(s => [...s.slice(-30), ...fresh]);
      const t = setTimeout(() => setSpawns(s => s.filter(x => !fresh.some(f => f.id === x.id))), 2400);
      return () => clearTimeout(t);
    }
  }, [entries, nodePositions]);

  return (
    <group>
      {spawns.map(s => <SpawnDot key={s.id} pos={s.pos} born={s.born} />)}
    </group>
  );
}

function SpawnDot({ pos, born }: { pos: THREE.Vector3; born: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = (Date.now() - born) / 1000;
    const m = ref.current;
    if (!m) return;
    const scale = Math.min(1, t * 1.6);
    m.scale.setScalar(0.2 + scale * 1.4);
    (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 2);
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[0.16, 12, 12]} />
      <meshBasicMaterial color="#f3c969" transparent opacity={1} />
    </mesh>
  );
}

// ---------- 主组件 ----------

export default function Universe3D({ entries, links, aiLinks = [], immersive = false }: {
  entries: Entry[];
  links: LinkItem[];
  aiLinks?: CandidateLink[];
  immersive?: boolean;
}) {
  const nav = useNavigate();
  const [positions, setPositions] = useState<[number, number][]>(loadPositions);
  const [zoomTarget, setZoomTarget] = useState<number | null>(null);
  const [hovered, setHovered] = useState<{ entry: Entry; x: number; y: number } | null>(null);

  const mine = useMemo(() => entries.filter(e => !e.isDefault && !e.deletedAt), [entries]);

  // 宇宙膨胀：条目越多，星系基圆越大（对数尺度封顶 45%）
  const expansion = useMemo(() => Math.min(1 + Math.log10(1 + mine.length) * 0.12, 1.45), [mine.length]);

  const galaxyPos = useMemo(
    () => positions.map(p => new THREE.Vector3(p[0] * expansion, p[1] * expansion, 0)),
    [positions, expansion]
  );

  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const e of mine) {
      const idx = VOIDS.findIndex(v => v.id === e.primaryVoid);
      const gp = positions[idx] ?? positions[0];
      const off = nodeOffset(e.id);
      map.set(e.id, new THREE.Vector3((gp[0] + off[0]) * expansion, (gp[1] + off[1]) * expansion, off[2]));
    }
    return map;
  }, [mine, positions, expansion]);

  const onGalaxyMove = (i: number, x: number, y: number) => {
    setPositions(prev => {
      const next = prev.map(p => [...p] as [number, number]);
      next[i] = [x / expansion, y / expansion];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const zoomVec = zoomTarget === null ? null : galaxyPos[zoomTarget];

  return (
    <div className="universe3d">
      <Canvas camera={{ position: [0, 8, 30], fov: 55 }} dpr={[1, 1.75]}>
        <color attach="background" args={['#070b1c']} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 0, 30]} intensity={50} />
        <Starfield />
        {galaxyPos.map((p, i) => (
          <Galaxy
            key={VOIDS[i].id}
            v={VOIDS[i]}
            position={p}
            count={mine.filter(e => e.primaryVoid === VOIDS[i].id).length}
            onMove={(x, y) => onGalaxyMove(i, x, y)}
            onTap={() => setZoomTarget(z => (z === i ? null : i))}
          />
        ))}
        <Stardust
          entries={mine}
          nodePositions={nodePositions}
          onHover={(e, x, y) => setHovered(e ? { entry: e, x: x ?? 0, y: y ?? 0 } : null)}
          onOut={() => setHovered(null)}
          onClick={e => nav('/experience/' + e.id)}
        />
        <LinkLines links={links} nodePositions={nodePositions} />
        <AILinkLines links={aiLinks} nodePositions={nodePositions} />
        <Wormholes links={links} entries={mine} nodePositions={nodePositions} />
        <Supernovas entries={mine} nodePositions={nodePositions} onClick={e => nav('/experience/' + e.id)} />
        <SpawnGlow entries={mine} nodePositions={nodePositions} />
        <OrbitRig zoomTarget={zoomVec} />
      </Canvas>
      {!immersive && (
        <div className="universe-hint">
          拖拽旋转 · 滚轮缩放 · 拖拽星系重新摆放 · 点星系聚焦{zoomTarget !== null ? '（再点一次取消）' : ''} · 点星尘进入经历 · 超新星=灵感
        </div>
      )}
      {hovered && (
        <div className="stardust-card" style={{ left: Math.min(hovered.x + 14, window.innerWidth - 280), top: hovered.y + 14 }}>
          <b>{hovered.entry.title}</b>
          <span>
            <VoidTag id={hovered.entry.primaryVoid} />
            {hovered.entry.emotion?.label && <i>· {hovered.entry.emotion.label}</i>}
            {hovered.entry.insight && <i>· 💥 灵感</i>}
          </span>
        </div>
      )}
    </div>
  );
}

function VoidTag({ id }: { id: VoidId }) {
  const v = voidById(id);
  return <i style={{ color: v.color }}>{v.symbol} {v.name}</i>;
}
