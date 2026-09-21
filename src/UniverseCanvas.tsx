import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Entry, KnowledgeEntry, KnowledgeRelation, Relation, Transition, VoidId } from './domain';
import { VOIDS, getVoid } from './domain';

type Lens = 'atlas' | 'connections' | 'path' | 'knowledge';
interface Props { entries: Entry[]; knowledge: KnowledgeEntry[]; knowledgeRelations: KnowledgeRelation[]; relations: Relation[]; transitions: Transition[]; selectedId?: string; lens: Lens; zoom: number; onSelect: (entry: Entry) => void; onSelectKnowledge: (item: KnowledgeEntry) => void; }

const galaxyPositions: Record<VoidId, [number, number, number]> = {
  void: [-7.1, 3.2, -1], silence: [-2.5, 5.7, 1], fracture: [3.4, 4.5, -2], flow: [7.2, .6, 0], mirror: [4.5, -4.9, 1], nexus: [-2.3, -5.9, -1], limit: [-7.5, -2.4, 0]
};

function hash(text: string) { let n = 0; for (let i = 0; i < text.length; i++) n = ((n << 5) - n) + text.charCodeAt(i) | 0; return Math.abs(n); }
function glow(color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 3, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(.16, color); g.addColorStop(.48, color + '63'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default function UniverseCanvas({ entries, knowledge, knowledgeRelations, relations, transitions, selectedId, lens, zoom, onSelect, onSelectKnowledge }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect); select.current = onSelect;
  const selectKnowledge = useRef(onSelectKnowledge); selectKnowledge.current = onSelectKnowledge;

  useEffect(() => {
    const el = host.current!;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#070817', .034);
    const camera = new THREE.PerspectiveCamera(49, 1, .1, 100); camera.position.set(0, 1, 25);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); el.appendChild(renderer.domElement);
    const root = new THREE.Group(); scene.add(root);
    const stars = new THREE.BufferGeometry(); const positions = new Float32Array(2600 * 3);
    for (let i = 0; i < 2600; i++) { const r = 14 + Math.random() * 45, a = Math.random() * Math.PI * 2, z = (Math.random() - .5) * 28; positions.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3); }
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3)); scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#9fb2e5', size: .055, transparent: true, opacity: .82 })));
    const entryGroup = new THREE.Group(); const knowledgeGroup = new THREE.Group(); const lineGroup = new THREE.Group(); const movementGroup = new THREE.Group(); root.add(lineGroup, movementGroup, entryGroup, knowledgeGroup);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down: { x:number;y:number } | null = null; let yaw = .18; let pitch = -.04; let distance = 25 + zoom;

    const addGalaxies = () => VOIDS.forEach(v => {
      const [x,y,z] = galaxyPositions[v.id]; const g = new THREE.Group(); g.position.set(x,y,z); root.add(g);
      const disk = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(v.color), transparent: true, depthWrite: false, opacity: .8 })); disk.scale.set(5.2,5.2,1); g.add(disk);
      const core = new THREE.Mesh(new THREE.SphereGeometry(.33, 18, 18), new THREE.MeshBasicMaterial({ color: v.color })); g.add(core);
    });
    addGalaxies();
    const entryPos = new Map<string, THREE.Vector3>(); const knowledgePos = new Map<string, THREE.Vector3>();
    const connected = new Set<string>(selectedId ? [selectedId] : []);
    relations.forEach(relation => { if (relation.from===selectedId) connected.add(relation.to); if (relation.to===selectedId) connected.add(relation.from); });
    const focusKnowledge = new Set(knowledge.filter(item=>item.linkedEntryIds.includes(selectedId ?? '')).map(item=>item.id));
    let focusPoint = new THREE.Vector3();
    const build = () => {
      entryGroup.clear(); knowledgeGroup.clear(); lineGroup.clear(); movementGroup.clear(); entryPos.clear(); knowledgePos.clear();
      entries.forEach((entry, index) => {
        const center = galaxyPositions[entry.primaryVoid]; const h = hash(entry.id); const angle = (h % 628) / 100; const radius = .8 + ((h >> 5) % 38) / 10;
        const pos = new THREE.Vector3(center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius * .6, center[2] + ((h >> 11) % 25) / 20 - .6); entryPos.set(entry.id, pos);
        const v = getVoid(entry.primaryVoid); const focused = lens==='atlas' || !selectedId || connected.has(entry.id); const material = new THREE.MeshBasicMaterial({ color: entry.signal.colorHex || v.color, transparent: true, opacity: entry.id===selectedId ? 1 : focused ? .94 : .12 });
        const node = new THREE.Mesh(new THREE.SphereGeometry(.11 + entry.importance * .032, 16, 16), material); node.position.copy(pos); node.userData.entry = entry; entryGroup.add(node);
        const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(entry.signal.colorHex || v.color), transparent: true, depthWrite: false, opacity: entry.id===selectedId ? .95 : focused ? .5 : .08 })); aura.position.copy(pos); const s=(.65+entry.importance*.12)*(entry.id===selectedId?1.45:1); aura.scale.set(s,s,1); entryGroup.add(aura);
      });
      knowledge.forEach(item => {
        const center = galaxyPositions[item.voidType]; const h = hash(item.id); const angle = (h % 628) / 100 + .4; const radius = 3.4 + ((h >> 4) % 20) / 12;
        const pos = new THREE.Vector3(center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius * .65, center[2] + .35);
        knowledgePos.set(item.id,pos);
        const v = getVoid(item.voidType); const focused = lens==='atlas' || (lens==='knowledge' && (!selectedId || focusKnowledge.has(item.id))); const node = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshBasicMaterial({ color: v.soft, transparent: true, opacity: focused ? .98 : .12 }));
        node.position.copy(pos); node.userData.knowledge = item; knowledgeGroup.add(node);
        const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(v.color), transparent: true, depthWrite: false, opacity: focused ? .36 : .04 })); aura.position.copy(pos); aura.scale.set(.78,.78,1); knowledgeGroup.add(aura);
        item.linkedEntryIds.forEach(id => { const target = entryPos.get(id); if (!target) return; const isFocus=!selectedId || item.linkedEntryIds.includes(selectedId); const geometry = new THREE.BufferGeometry().setFromPoints([pos, target]); const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: v.soft, dashSize: .13, gapSize: .1, transparent: true, opacity: lens==='knowledge' && isFocus ? .95 : lens==='atlas' ? .48 : .06 })); line.computeLineDistances(); lineGroup.add(line); });
      });
      knowledgeRelations.forEach(rel=>{const a=knowledgePos.get(rel.from),b=knowledgePos.get(rel.to);if(!a||!b)return;const color=rel.type==='conflict'?'#f16b70':rel.type==='prerequisite'?'#9ed8ff':rel.type==='analogy'?'#f3c75f':'#c4a0ff';const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color,dashSize:.12,gapSize:.1,transparent:true,opacity:lens==='atlas'||lens==='knowledge'? .55:.07}));line.computeLineDistances();lineGroup.add(line);});
      relations.forEach(rel => { const a=entryPos.get(rel.from), b=entryPos.get(rel.to); if(!a||!b)return; const c=rel.type==='tension'?'#f16b70':rel.type==='resonance'?'#f3c75f':'#99c4ff'; const isFocus=!selectedId||rel.from===selectedId||rel.to===selectedId; const geometry=new THREE.BufferGeometry().setFromPoints([a,b]); const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:c,transparent:true,opacity:lens==='connections' ? (isFocus ? .92 : .04) : lens==='atlas' ? .38 : .07})); lineGroup.add(line); });
      if (lens==='path') transitions.filter(item=>!selectedId||item.entryId===selectedId).forEach(item=>{const from=new THREE.Vector3(...galaxyPositions[item.from]);const to=new THREE.Vector3(...galaxyPositions[item.to]);const control=from.clone().add(to).multiplyScalar(.5).add(new THREE.Vector3(0,1.7,1.4));const curve=new THREE.QuadraticBezierCurve3(from,control,to);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),new THREE.LineDashedMaterial({color:'#f3c75f',dashSize:.18,gapSize:.1,transparent:true,opacity:.95}));line.computeLineDistances();movementGroup.add(line);});
      focusPoint = selectedId && lens!=='atlas' ? (entryPos.get(selectedId)?.clone() ?? new THREE.Vector3()) : new THREE.Vector3();
    };
    build();
    const resize = () => { const r=el.getBoundingClientRect(); renderer.setSize(r.width,r.height); camera.aspect=r.width/r.height;camera.updateProjectionMatrix(); };
    const moveCamera = () => { camera.position.set(Math.sin(yaw)*distance+focusPoint.x, pitch*distance+1+focusPoint.y, Math.cos(yaw)*distance+focusPoint.z); camera.lookAt(focusPoint); };
    const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const onMove=(e:PointerEvent)=>{if(!down||e.pointerType==='touch')return; yaw-=(e.clientX-down.x)*.006; pitch=Math.max(-.3,Math.min(.28,pitch+(e.clientY-down.y)*.003));down={x:e.clientX,y:e.clientY};};
    const onUp=(e:PointerEvent)=>{if(!down)return; const rect=renderer.domElement.getBoundingClientRect(); pointer.x=((e.clientX-rect.left)/rect.width)*2-1; pointer.y=-((e.clientY-rect.top)/rect.height)*2+1; raycaster.setFromCamera(pointer,camera); const targets=[...entryGroup.children,...knowledgeGroup.children].filter(o=>o instanceof THREE.Mesh); const object=raycaster.intersectObjects(targets)[0]?.object; const entry=object?.userData.entry as Entry|undefined; const item=object?.userData.knowledge as KnowledgeEntry|undefined; if(entry)select.current(entry); if(item)selectKnowledge.current(item);down=null;};
    const ro=new ResizeObserver(resize);ro.observe(el);renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerup',onUp);
    let frame=0; const animate=()=>{frame=requestAnimationFrame(animate);if(lens==='atlas')root.rotation.z+=.00045;moveCamera();renderer.render(scene,camera);};animate();
    return()=>{cancelAnimationFrame(frame);ro.disconnect();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointerup',onUp);renderer.dispose();el.innerHTML='';};
  },[entries, knowledge, knowledgeRelations, relations, transitions, selectedId, lens, zoom]);
  return <div ref={host} className="universe-canvas" aria-label="可旋转的七空宇宙，点击星尘查看经历" />;
}
