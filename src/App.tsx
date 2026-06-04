// App.tsx
// SISTEMA DE CUBAGEM 3D COM THREE.JS E ROTAÇÃO MANUAL
// ==============================================================

import * as THREE from 'three';
import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Package, Truck, Layers, Plus, Trash2, TrendingUp, AlertTriangle, 
  CheckCircle2, Box, Scale, Maximize2, RefreshCw, Download, Eye, HelpCircle
} from 'lucide-react';

  // Declaração global para o THREE
  declare global {
    interface Window {
      THREE: any;
    }
  }

// ==============================================================
// HOOK: INICIALIZAÇÃO DO THREE.JS VIA CDN
// ==============================================================
// [FUNÇÃO IMPORTANTE] Carrega a biblioteca Three.js dinamicamente
// O uso de CDN evita a necessidade de instalação via npm
// Retorna 'loaded' como booleano para controlar quando o canvas pode ser renderizado
function useThreeJS() {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    // [CHECK] Se o THREE já existe no window, não recarrega
    if (window.THREE) {
      setLoaded(true);
      return;
    }
    
    // [CDN] Three.js versão r128 (estável e compatível)
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  
  return loaded;
}

export default function App() {
  const threeLoaded = useThreeJS();

  // ==============================================================
  // ESTADO: CONFIGURAÇÕES DAS CAIXAS DE MADEIRA
  // ==============================================================
  // [CONFIG] Tipos de embalagens disponíveis para o algoritmo
  // Cada caixa tem: id (identificador), nome, dimensões (l,a,c em cm),
  // peso máximo suportado, volume pré-calculado em m³, e classe de cor
  const [tiposCaixas, setTiposCaixas] = useState([
    { id: 'P', nome: 'Caixa Pequena', l: 40, a: 40, c: 40, pesoMax: 30, volume: 0.064, cor: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' },
    { id: 'M', nome: 'Caixa Média', l: 80, a: 60, c: 60, pesoMax: 100, volume: 0.288, cor: 'border-blue-500/30 bg-blue-500/5 text-blue-400' },
    { id: 'G', nome: 'Caixa Grande', l: 120, a: 80, c: 80, pesoMax: 300, volume: 0.768, cor: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400' }
  ]);

  // [CONFIG] Configuração do contêiner de transporte (ex: contêiner de navio)
  // l,a,c = dimensões internas em cm | pesoMax em kg | volumeMax em m³
  const [containerConfig, setContainerConfig] = useState({
    nome: 'Contêiner 20 Pés',
    l: 590, a: 235, c: 239,
    pesoMax: 21800,
    volumeMax: 33.2
  });

  // ==============================================================
  // ESTADO: PRODUTOS A SEREM EMBARCADOS
  // ==============================================================
  // [DADOS] Lista de produtos com suas dimensões, peso e quantidade
  // corBg é a cor individual de cada produto para distinção visual
  const [produtos, setProdutos] = useState([
    { id: 1, nome: 'Motor Elétrico Industrial IP55', l: 30, a: 20, c: 20, peso: 12.0, qtd: 12, corBg: '#3b82f6' },
    { id: 2, nome: 'Painel de Comando Alumínio', l: 50, a: 40, c: 30, peso: 18.5, qtd: 6, corBg: '#8b5cf6' },
    { id: 3, nome: 'Componentes Eletrônicos A3', l: 20, a: 15, c: 10, peso: 2.1, qtd: 20, corBg: '#10b981' }
  ]);

  // [FORM] Estado para o formulário de adição de novos produtos
  const [novoProd, setNovoProd] = useState({
    nome: '', l: '', a: '', c: '', peso: '', qtd: '1', corBg: '#f59e0b'
  });

  // ==============================================================
  // ESTADO: INTERFACE DO USUÁRIO
  // ==============================================================
  const [abaAtiva, setAbaAtiva] = useState('dashboard'); // 'dashboard', 'caixas', 'configuracoes'
  const [caixaSelecionadaVisualizar, setCaixaSelecionadaVisualizar] = useState(1); // ID da caixa sendo visualizada em 3D
  const [modoProjecao, setModoProjecao] = useState('superior'); // 'superior' ou 'frontal' para vista 2D
  const [hoveredItemIndex, setHoveredItemIndex] = useState(null); // Índice do item com hover na planta 2D
  
  // [EDIT] Estados temporários para edição nas configurações
  const [editandoCaixas, setEditandoCaixas] = useState([...tiposCaixas]);
  const [configTempContainer, setConfigTempContainer] = useState({...containerConfig});

  // [CORES] Paleta de cores para novos produtos (cíclica)
  const paletaCores = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#a855f7', '#06b6d4'];

  // ==============================================================
  // FUNÇÕES: MANIPULAÇÃO DO INVENTÁRIO
  // ==============================================================
  // [CRUD] Atualiza quantidade de um produto (+1 ou -1)
  const atualizarQtd = (id, incremento) => {
    setProdutos(prev => prev.map(p => {
      if (p.id === id) {
        const novaQtd = Math.max(0, p.qtd + incremento);
        return { ...p, qtd: novaQtd };
      }
      return p;
    }).filter(p => p.qtd > 0)); // Remove se quantidade = 0
  };

  // [CRUD] Remove produto completamente da lista
  const removerProduto = (id) => {
    setProdutos(prev => prev.filter(p => p.id !== id));
  };

  // [CRUD] Adiciona novo produto à lista
  const adicionarProduto = (e) => {
    e.preventDefault();
    // [VALIDATION] Verifica se todos os campos obrigatórios estão preenchidos
    if (!novoProd.nome || !novoProd.l || !novoProd.a || !novoProd.c || !novoProd.peso) return;

    const proximaCor = paletaCores[produtos.length % paletaCores.length];

    setProdutos(prev => [
      ...prev,
      {
        id: Date.now(), // ID único baseado no timestamp
        nome: novoProd.nome,
        l: parseInt(novoProd.l),
        a: parseInt(novoProd.a),
        c: parseInt(novoProd.c),
        peso: parseFloat(novoProd.peso),
        qtd: parseInt(novoProd.qtd),
        corBg: proximaCor
      }
    ]);

    // Limpa o formulário
    setNovoProd({ nome: '', l: '', a: '', c: '', peso: '', qtd: '1', corBg: '#f59e0b' });
  };

  // ==============================================================
  // ALGORITMO HEURÍSTICO DE EMPACOTAMENTO 3D
  // ==============================================================
  // [CORE] Este é o coração do sistema - algoritmo Best-Fit para empacotamento 3D
  // O useMemo recalcula apenas quando produtos, caixas ou container mudam
  const resultadoOtimizacao = useMemo(() => {
    // [PASSO 1] Transforma lotes em itens individuais
    // Ex: 12 unidades de um produto viram 12 objetos separados
    let itensIndividuais = [];
    produtos.forEach(p => {
      for (let i = 0; i < p.qtd; i++) {
        itensIndividuais.push({
          ...p,
          uid: `${p.id}-${i}`, // Identificador único por unidade
          volIndividual: (p.l * p.a * p.c) / 1000000 // Volume em m³
        });
      }
    });

    // [PASSO 2] Ordena do maior para o menor volume (greedy approach)
    itensIndividuais.sort((a, b) => b.volIndividual - a.volIndividual);

    // [PASSO 3] Função interna que tenta empacotar itens em uma caixa
    // Retorna o layout 3D (posições x,y,z) ou null se não couber
    const tentarEmpacotarEmCaixa = (tipoCaixa, itensExistentes, novoItem) => {
      const itensParaTestar = [...itensExistentes, novoItem];
      const packed = []; // Array de {item, x, y, z, dx, dy, dz}

      for (let item of itensParaTestar) {
        let alocado = false;
        
        // [ROTAÇÃO] Testa todas as 6 orientações possíveis do item
        // (trocar l,a,c entre si para melhor encaixe)
        const orientacoes = [
          { dx: item.l, dy: item.a, dz: item.c },
          { dx: item.l, dy: item.c, dz: item.a },
          { dx: item.c, dy: item.l, dz: item.a },
          { dx: item.c, dy: item.a, dz: item.l },
          { dx: item.a, dy: item.l, dz: item.c },
          { dx: item.a, dy: item.c, dz: item.l }
        ];

        for (let orient of orientacoes) {
          const { dx, dy, dz } = orient;
          
          // [CANTOS] Gera pontos candidatos baseados nos vértices livres
          const candidatos = [{ x: 0, y: 0, z: 0 }];
          for (let p of packed) {
            candidatos.push({ x: p.x + p.dx, y: p.y, z: p.z });
            candidatos.push({ x: p.x, y: p.y + p.dy, z: p.z });
            candidatos.push({ x: p.x, y: p.y, z: p.z + p.dz });
          }

          // [ORDENAÇÃO] Prioriza cantos inferiores e fundo
          candidatos.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y; // Prioriza base (y)
            if (a.z !== b.z) return a.z - b.z; // Prioriza fundo (z)
            return a.x - b.x; // Prioriza esquerda (x)
          });

          for (let cand of candidatos) {
            const { x, y, z } = cand;

            // [COLISÃO] Verifica se cabe dentro da caixa
            if (x + dx <= tipoCaixa.l && y + dy <= tipoCaixa.a && z + dz <= tipoCaixa.c) {
              
              // [COLISÃO] Verifica se sobrepõe outros itens já posicionados
              let sobrepoe = false;
              for (let p of packed) {
                const semColisao = (
                  x + dx <= p.x || x >= p.x + p.dx ||
                  y + dy <= p.y || y >= p.y + p.dy ||
                  z + dz <= p.z || z >= p.z + p.dz
                );
                if (!semColisao) {
                  sobrepoe = true;
                  break;
                }
              }

              if (!sobrepoe) {
                // [SUCESSO] Posiciona o item
                packed.push({ item, x, y, z, dx, dy, dz });
                alocado = true;
                break;
              }
            }
          }
          if (alocado) break;
        }

        if (!alocado) return null; // Falhou - não cabe nesta caixa
      }
      return packed;
    };

    let caixasGeradas = [];

    // [PASSO 4] Empacota cada item nas caixas disponíveis
    itensIndividuais.forEach(item => {
      let alocado = false;

      // Tenta inserir em caixas já existentes (que ainda têm capacidade)
      for (let caixa of caixasGeradas) {
        // [PESO] Verifica limite de peso da caixa
        if (caixa.pesoAtual + item.peso <= caixa.tipo.pesoMax) {
          const novoLayout = tentarEmpacotarEmCaixa(caixa.tipo, caixa.itens, item);
          if (novoLayout) {
            caixa.itens.push(item);
            caixa.layout3D = novoLayout;
            caixa.pesoAtual += item.peso;
            caixa.volAtual += item.volIndividual;
            alocado = true;
            break;
          }
        }
      }

      // Se não coube em nenhuma caixa existente, cria uma nova
      if (!alocado) {
        // Encontra o tipo de caixa ideal (que cabe o item)
        const tipoIdeal = tiposCaixas.find(tc => {
          const layout = tentarEmpacotarEmCaixa(tc, [], item);
          return layout !== null && item.peso <= tc.pesoMax;
        }) || tiposCaixas[tiposCaixas.length - 1]; // Fallback: maior caixa

        const layoutInicial = tentarEmpacotarEmCaixa(tipoIdeal, [], item) || [
          { item, x: 0, y: 0, z: 0, dx: item.l, dy: item.a, dz: item.c }
        ];

        caixasGeradas.push({
          id: caixasGeradas.length + 1,
          tipo: tipoIdeal,
          itens: [item],
          layout3D: layoutInicial,
          pesoAtual: item.peso,
          volAtual: item.volIndividual
        });
      }
    });

    // [PASSO 5] Cálculo dos KPIs de expedição
    const volumeTotalCaixas = caixasGeradas.reduce((acc, c) => acc + c.tipo.volume, 0);
    const pesoTotalCaixas = caixasGeradas.reduce((acc, c) => acc + c.pesoAtual, 0);

    // Quantos contêineres são necessários? (máximo entre volume e peso)
    let qtdContainers = 0;
    if (caixasGeradas.length > 0) {
      const porVolume = Math.ceil(volumeTotalCaixas / containerConfig.volumeMax);
      const porPeso = Math.ceil(pesoTotalCaixas / containerConfig.pesoMax);
      qtdContainers = Math.max(porVolume, porPeso, 1);
    }

    // Percentual de aproveitamento volumétrico
    const volumeOcupadoPercent = qtdContainers > 0 
      ? (volumeTotalCaixas / (qtdContainers * containerConfig.volumeMax)) * 100 
      : 0;

    const espacoDesperdicado = (qtdContainers * containerConfig.volumeMax) - volumeTotalCaixas;

    return {
      caixas: caixasGeradas,      // Lista de caixas com seus layouts 3D
      qtdContainers,               // Número de contêineres necessários
      volumeTotalCaixas,          // Volume total ocupado pelas caixas
      pesoTotalCaixas,            // Peso total das mercadorias
      volumeOcupadoPercent,       // Percentual de aproveitamento
      espacoDesperdicado: espacoDesperdicado < 0 ? 0 : espacoDesperdicado // Espaço não utilizado
    };
  }, [produtos, tiposCaixas, containerConfig]);

  // [SIDE EFFECT] Garante que a caixa selecionada seja válida
  // Se a caixa atual foi removida, seleciona a primeira disponível
  useEffect(() => {
    if (resultadoOtimizacao.caixas.length > 0) {
      const existe = resultadoOtimizacao.caixas.some(c => c.id === caixaSelecionadaVisualizar);
      if (!existe) {
        setCaixaSelecionadaVisualizar(resultadoOtimizacao.caixas[0].id);
      }
    }
  }, [resultadoOtimizacao, caixaSelecionadaVisualizar]);

  // ==============================================================
  // RENDERIZAÇÃO 3D COM THREE.JS (ROTAÇÃO MANUAL)
  // ==============================================================
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);      // ← Corrigido
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  // [THREE.JS] Effect principal para criar e gerenciar a cena 3D
  useEffect(() => {
    // [GUARD] Só executa se Three.js já carregou e o canvas existe
    if (!threeLoaded || !canvasRef.current) return;

    const container = canvasRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = 300;

    // [CENA] Configuração da cena Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617'); // slate-950
    sceneRef.current = scene;

    // [CÂMERA] Perspectiva isométrica
    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 1500);
    camera.position.set(0, 35, 120); // Posição diagonal (x,y,z)
    cameraRef.current = camera;

    // [RENDERIZADOR] WebGL com sombras e antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; // Habilita sombras
    
    // Limpa renderizações anteriores e adiciona ao DOM
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // [LUZES] Iluminação da cena
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Luz ambiente
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8); // Luz direcional principal
    dirLight1.position.set(100, 150, 50);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.4); // Luz de preenchimento azul
    dirLight2.position.set(-100, 50, -50);
    scene.add(dirLight2);

    // [GRID] Chão auxiliar para referência espacial
    const gridHelper = new THREE.GridHelper(150, 30, 0x475569, 0x334155);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // [CRIAÇÃO DO GRUPO 3D] Baseado na caixa selecionada
    const caixaAtual = resultadoOtimizacao.caixas.find(c => c.id === caixaSelecionadaVisualizar);
    let group = new THREE.Group();

    if (caixaAtual) {
      const { l, a, c } = caixaAtual.tipo;
      
      // [ESCALA] Ajusta o tamanho para caber no viewport
      const maxDim = Math.max(l, a, c);
      const scaleFactor = 60 / maxDim; // Fator de escala dinâmico
      group.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // [CAIXA EXTERNA] Envoltório translúcido da embalagem
      const outerGeo = new THREE.BoxGeometry(l, a, c);
      const outerMat = new THREE.MeshPhongMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.15, // Semitransparente para ver os itens dentro
        wireframe: false,
        depthWrite: false
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.position.set(l / 2, a / 2, c / 2);
      group.add(outerMesh);

      // [BORDAS] Wireframe azul da caixa
      const edges = new THREE.EdgesGeometry(outerGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
      line.position.set(l / 2, a / 2, c / 2);
      group.add(line);

      // [ITENS INTERNOS] Renderiza cada produto dentro da caixa
      caixaAtual.layout3D.forEach((itemPos, idx) => {
        const { item, x, y, z, dx, dy, dz } = itemPos;
        // Diminui ligeiramente para criar espaço visual entre itens
        const geo = new THREE.BoxGeometry(dx - 0.8, dy - 0.8, dz - 0.8);
        
        // [HOVER] Destaque visual se o item está selecionado na UI 2D
        const isHovered = hoveredItemIndex === idx;
        const itemColor = isHovered ? '#ffffff' : item.corBg; // Branco quando hover

        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(itemColor),
          roughness: 0.2,
          metalness: 0.1,
          shininess: 40,
          transparent: true,
          opacity: isHovered ? 0.95 : 0.85
        });

        const mesh = new THREE.Mesh(geo, mat);
        // Posiciona no centro do objeto (Three.js usa centro do BoxGeometry)
        mesh.position.set(x + dx / 2, y + dy / 2, z + dz / 2);
        group.add(mesh);

        // [CONTORNO] Borda preta sutil para cada item
        const itemEdges = new THREE.EdgesGeometry(geo);
        const itemLine = new THREE.LineSegments(itemEdges, new THREE.LineBasicMaterial({ color: 0x0f172a, opacity: 0.5 }));
        itemLine.position.set(x + dx / 2, y + dy / 2, z + dz / 2);
        group.add(itemLine);
      });

      // Centraliza o grupo na cena
      group.position.set(- (l * scaleFactor) / 2, 0, - (c * scaleFactor) / 2);
    }

    scene.add(group);
    groupRef.current = group;

    // ============================================================
    // CONTROLES MANUAIS DE ROTAÇÃO (DRAG AND DROP)
    // ============================================================
    // [INTERAÇÃO] Sistema de rotação por mouse/touch
    // Alternativa quando OrbitControls não está disponível
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      isDragging = true;
      // Captura posição inicial
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      previousMousePosition = { x: clientX, y: clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaMove = {
        x: clientX - previousMousePosition.x,
        y: clientY - previousMousePosition.y
      };

      // [ROTAÇÃO] Aplica rotação baseada no movimento do mouse
      // Rotação no eixo Y (horizontal) e X (vertical)
      group.rotation.y += deltaMove.x * 0.01;
      group.rotation.x += deltaMove.y * 0.01;

      previousMousePosition = { x: clientX, y: clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    // [EVENTOS] Suporte para mouse e touch (mobile)
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);

    // [ANIMAÇÃO] Loop de renderização contínuo
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      
      // [AUTO-ROTAÇÃO] Movimento sutil quando não está interagindo
      if (!isDragging) {
        group.rotation.y += 0.003; // Gira 0.003 radianos por frame
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // [RESPONSIVIDADE] Ajusta tamanho do canvas quando a janela redimensiona
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      rendererRef.current.setSize(w, height);
      cameraRef.current.aspect = w / height;
      cameraRef.current.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    // [CLEANUP] Remove event listeners e libera recursos
    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      resizeObserver.disconnect();
    };
  }, [threeLoaded, caixaSelecionadaVisualizar, resultadoOtimizacao, hoveredItemIndex]);

  // ==============================================================
  // FUNÇÕES: CONFIGURAÇÕES E RELATÓRIOS
  // ==============================================================
  
  // [CONFIG] Salva as configurações personalizadas de caixas e container
  const salvarConfiguracoes = (e) => {
    e.preventDefault();
    setTiposCaixas(editandoCaixas);
    setContainerConfig(configTempContainer);
    setAbaAtiva('dashboard');
  };

  // [CONFIG] Restaura as configurações padrão do sistema
  const restaurarPadroes = () => {
    const padraoCaixas = [
      { id: 'P', nome: 'Caixa Pequena', l: 40, a: 40, c: 40, pesoMax: 30, volume: 0.064, cor: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' },
      { id: 'M', nome: 'Caixa Média', l: 80, a: 60, c: 60, pesoMax: 100, volume: 0.288, cor: 'border-blue-500/30 bg-blue-500/5 text-blue-400' },
      { id: 'G', nome: 'Caixa Grande', l: 120, a: 80, c: 80, pesoMax: 300, volume: 0.768, cor: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400' }
    ];
    const padraoContainer = {
      nome: 'Contêiner 20 Pés',
      l: 590, a: 235, c: 239,
      pesoMax: 21800,
      volumeMax: 33.2
    };
    setTiposCaixas(padraoCaixas);
    setEditandoCaixas(padraoCaixas);
    setContainerConfig(padraoContainer);
    setConfigTempContainer(padraoContainer);
  };

  // [RELATÓRIO] Exporta os dados em formato TXT para download
  const baixarRelatorioLogistica = () => {
    let reportText = `RELATÓRIO DE CUBAGEM E EXPEDIÇÃO 3D\n`;
    reportText += `===============================================\n`;
    reportText += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n`;
    reportText += `Tipo do Transporte: ${containerConfig.nome}\n`;
    reportText += `Capacidade Máxima: ${containerConfig.volumeMax} m³ / ${containerConfig.pesoMax.toLocaleString('pt-BR')} kg\n`;
    reportText += `===============================================\n\n`;
    reportText += `KPIs GERAIS:\n`;
    reportText += `- Contêineres de Destino Necessários: ${resultadoOtimizacao.qtdContainers}\n`;
    reportText += `- Volume Ocupado pelas Caixas: ${resultadoOtimizacao.volumeTotalCaixas.toFixed(2)} m³ (${resultadoOtimizacao.volumeOcupadoPercent.toFixed(1)}%)\n`;
    reportText += `- Peso Total Embarcado: ${resultadoOtimizacao.pesoTotalCaixas.toLocaleString('pt-BR')} kg\n`;
    reportText += `- Cubagem Ociosa Paga: ${resultadoOtimizacao.espacoDesperdicado.toFixed(2)} m³\n\n`;
    reportText += `ORGANIZAÇÃO POR CAIXAS DE EMBALAGEM:\n`;
    
    resultadoOtimizacao.caixas.forEach(c => {
      reportText += `-----------------------------------------------\n`;
      reportText += `Caixa de Madeira #${c.id} [Tipo: ${c.tipo.nome} (${c.tipo.id})]\n`;
      reportText += `- Dimensões: ${c.tipo.l}x${c.tipo.a}x${c.tipo.c} cm (Vol: ${c.tipo.volume} m³)\n`;
      reportText += `- Peso do Lote Interno: ${c.pesoAtual.toFixed(1)} kg / Max: ${c.tipo.pesoMax} kg\n`;
      reportText += `- Itens Integrados no Volume:\n`;
      
      // Agrupa itens iguais para exibição compacta
      const contagemItens = {};
      c.itens.forEach(item => {
        contagemItens[item.nome] = (contagemItens[item.nome] || 0) + 1;
      });
      
      Object.entries(contagemItens).forEach(([nome, qtd]) => {
        reportText += `  * ${qtd}x - ${nome}\n`;
      });
    });

    // [DOWNLOAD] Cria e dispara o download do arquivo
    const element = document.createElement("a");
    const file = new Blob([reportText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `relatorio-cubagem-3D.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // ==============================================================
  // RENDERIZAÇÃO DA INTERFACE (JSX)
  // ==============================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-6">
      
      {/* HEADER - Cabeçalho com título e ações */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-5 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-500 font-semibold tracking-wider text-xs uppercase">
            <Layers className="w-4 h-4" /> Inteligência Logística Avançada
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Plataforma de Cubagem 3D <span className="text-slate-400 text-lg font-normal">| Simulador de Expedição</span>
          </h1>
        </div>
        
        {/* Botões de ação */}
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <button
            onClick={baixarRelatorioLogistica}
            className="flex-1 lg:flex-none bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg px-4 py-2 flex items-center justify-center gap-2 text-xs md:text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4 text-slate-400" /> Relatório TXT
          </button>
          <div className="flex-1 lg:flex-none bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 flex items-center justify-center gap-3 text-xs md:text-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-300 font-medium">Algoritmo 3D Best-Fit Ativo</span>
          </div>
        </div>
      </header>

      {/* 
        ============================================================
        LAYOUT PRINCIPAL: Grid 12 colunas
        - Coluna esquerda (5 colunas): Cadastro e lista de produtos
        - Coluna direita (7 colunas): KPIs, abas e visualização 3D
        ============================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ============================================================
            COLUNA ESQUERDA - CADASTRO E FILA DE PRODUTOS
        ============================================================ */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* PAINEL DE ADIÇÃO DE PRODUTOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" /> Inserir Peças para Embarque
            </h2>
            <form onSubmit={adicionarProduto} className="space-y-4">
              {/* Campo Nome */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Nome do Produto / SKU Comercial</label>
                <input 
                  type="text" required placeholder="Ex: Motor de Indução Trifásico 15CV"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  value={novoProd.nome} onChange={e => setNovoProd({...novoProd, nome: e.target.value})}
                />
              </div>
              
              {/* Dimensões (L, A, C) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Largura (cm)</label>
                  <input 
                    type="number" required min="1" placeholder="Ex: 30"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    value={novoProd.l} onChange={e => setNovoProd({...novoProd, l: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Altura (cm)</label>
                  <input 
                    type="number" required min="1" placeholder="Ex: 20"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    value={novoProd.a} onChange={e => setNovoProd({...novoProd, a: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Comprim. (cm)</label>
                  <input 
                    type="number" required min="1" placeholder="Ex: 25"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    value={novoProd.c} onChange={e => setNovoProd({...novoProd, c: e.target.value})}
                  />
                </div>
              </div>
              
              {/* Peso e Quantidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Peso Unitário (kg)</label>
                  <input 
                    type="number" step="0.1" required min="0.1" placeholder="Ex: 15.5"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    value={novoProd.peso} onChange={e => setNovoProd({...novoProd, peso: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Qtd. Lote</label>
                  <input 
                    type="number" required min="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    value={novoProd.qtd} onChange={e => setNovoProd({...novoProd, qtd: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-4 h-4" /> Adicionar à Grade de Cubagem
              </button>
            </form>
          </div>

          {/* LISTA DE PRODUTOS NA FILA */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" /> Fila Atual de Expedição ({produtos.length})
              </h2>
              <span className="text-xxs text-slate-400 bg-slate-950 px-2 py-1 rounded">Total Peças: {produtos.reduce((acc, p) => acc + p.qtd, 0)}</span>
            </div>
            
            {produtos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                Nenhum produto cadastrado para simulação.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {produtos.map(p => (
                  <div key={p.id} className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex justify-between items-center hover:border-slate-700 transition-all">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.corBg }}></span>
                        <h4 className="text-sm font-semibold text-white truncate">{p.nome}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5 text-slate-500" /> {p.l}x{p.a}x{p.c} cm</span>
                        <span className="flex items-center gap-1"><Scale className="w-3.5 h-3.5 text-slate-500" /> {p.peso} kg</span>
                      </div>
                    </div>
                    
                    {/* Controles de quantidade e remoção */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md overflow-hidden">
                        <button onClick={() => atualizarQtd(p.id, -1)} className="px-2.5 py-1 text-slate-400 hover:bg-slate-800 text-xs font-bold transition-colors">-</button>
                        <span className="px-3 text-xs font-bold text-white bg-slate-950">{p.qtd}</span>
                        <button onClick={() => atualizarQtd(p.id, 1)} className="px-2.5 py-1 text-slate-400 hover:bg-slate-800 text-xs font-bold transition-colors">+</button>
                      </div>
                      <button 
                        onClick={() => removerProduto(p.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            COLUNA DIREITA - KPIs, ABAS E VISUALIZAÇÃO
        ============================================================ */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CARDS DE KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card: Contêineres Necessários */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Contêineres ({containerConfig.nome})</p>
                <p className="text-2xl font-black text-white mt-1">{resultadoOtimizacao.qtdContainers}</p>
              </div>
            </div>
            
            {/* Card: Aproveitamento Útil */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
              <div className={`p-3 rounded-lg border ${
                resultadoOtimizacao.volumeOcupadoPercent > 75 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Aproveit. Útil</p>
                <p className="text-2xl font-black text-white mt-1">
                  {resultadoOtimizacao.volumeOcupadoPercent.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Card: Embalagens de Madeira */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all"></div>
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <Box className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Embalagens de Madeira</p>
                <p className="text-2xl font-black text-white mt-1">{resultadoOtimizacao.caixas.length}</p>
              </div>
            </div>
          </div>

          {/* SISTEMA DE ABAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="border-b border-slate-800 bg-slate-900/50 px-4 flex gap-2">
              <button 
                onClick={() => setAbaAtiva('dashboard')}
                className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  abaAtiva === 'dashboard' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Análise de Otimização
              </button>
              <button 
                onClick={() => setAbaAtiva('caixas')}
                className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  abaAtiva === 'caixas' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Organização Física e Layout
              </button>
              <button 
                onClick={() => setAbaAtiva('configuracoes')}
                className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  abaAtiva === 'configuracoes' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Parametrização
              </button>
            </div>

            <div className="p-6">
              
              {/* ============================================================
                  ABA 1: DASHBOARD - ANÁLISE DE OTIMIZAÇÃO
              ============================================================ */}
              {abaAtiva === 'dashboard' && (
                <div className="space-y-6">
                  
                  {/* Barra de progresso de capacidade */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-blue-500" /> Capacidade do Volume Geral de Frete
                      </span>
                      <span className="text-sm font-bold text-white">
                        {resultadoOtimizacao.volumeTotalCaixas.toFixed(2)} m³ / {(resultadoOtimizacao.qtdContainers * containerConfig.volumeMax).toFixed(2)} m³
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-4 border border-slate-800 overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          resultadoOtimizacao.volumeOcupadoPercent > 75 
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                            : 'bg-gradient-to-r from-amber-500 to-orange-400'
                        }`}
                        style={{ width: `${Math.min(resultadoOtimizacao.volumeOcupadoPercent, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                      <span>0% (Vazio)</span>
                      <span className="font-medium text-slate-300">{resultadoOtimizacao.volumeOcupadoPercent.toFixed(1)}% de aproveitamento volumétrico contratado</span>
                      <span>100% (Cheio)</span>
                    </div>
                  </div>

                  {/* Métricas de peso e espaço ocioso */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <Scale className="w-4 h-4 text-blue-400" /> Peso Total Líquido
                      </div>
                      <p className="text-xl font-bold text-white">
                        {resultadoOtimizacao.pesoTotalCaixas.toLocaleString('pt-BR')} kg
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Limite Total de Carga: {(resultadoOtimizacao.qtdContainers * containerConfig.pesoMax).toLocaleString('pt-BR')} kg
                      </p>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Cubagem Ociosa Contratada
                      </div>
                      <p className={`text-xl font-bold ${resultadoOtimizacao.espacoDesperdicado > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {resultadoOtimizacao.espacoDesperdicado.toFixed(2)} m³
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Volume desperdiçado nos contêineres abertos
                      </p>
                    </div>
                  </div>

                  {/* Alerta inteligente baseado na eficiência */}
                  {resultadoOtimizacao.volumeOcupadoPercent > 0 ? (
                    <div className={`border rounded-xl p-4 flex items-start gap-3.5 ${
                      resultadoOtimizacao.volumeOcupadoPercent >= 75 
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' 
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                    }`}>
                      {resultadoOtimizacao.volumeOcupadoPercent >= 75 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Eficiência de Enquadramento Excelente</h4>
                            <p className="text-xs text-slate-400 mt-1">
                              O arranjo geométrico de cubagem das caixas de madeira atingiu excelentes índices de utilização do espaço de transporte. Custo logístico otimizado.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-white">Alerta de Espaço Ocioso</h4>
                            <p className="text-xs text-slate-400 mt-1">
                              O volume das caixas geradas é baixo para otimizar os custos totais do contêiner ativo. Recomendamos adensar mais pacotes de venda ou negociar transporte fracionado (LCL).
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                      Adicione itens e produtos na lista para gerar a análise de cubagem do transporte.
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================
                  ABA 2: ORGANIZAÇÃO FÍSICA E LAYOUT (VISUALIZAÇÃO 3D)
              ============================================================ */}
              {abaAtiva === 'caixas' && (
                <div className="space-y-6">
                  {resultadoOtimizacao.caixas.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      Adicione itens na grade de produção para planejar os volumes de madeira.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                      
                      {/* Lista de caixas disponíveis */}
                      <div className="xl:col-span-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Selecione um Volume ({resultadoOtimizacao.caixas.length})
                        </label>
                        {resultadoOtimizacao.caixas.map(caixa => (
                          <div 
                            key={caixa.id}
                            onClick={() => setCaixaSelecionadaVisualizar(caixa.id)}
                            className={`border rounded-lg p-3 cursor-pointer transition-all ${
                              caixaSelecionadaVisualizar === caixa.id 
                                ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/5' 
                                : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-white">Embalagem #{caixa.id}</span>
                              <span className="text-xxs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-semibold text-blue-400">
                                {caixa.tipo.id}
                              </span>
                            </div>
                            <div className="space-y-1 mt-2 text-xxs text-slate-400">
                              <div className="flex justify-between">
                                <span>Capacidade Peso:</span>
                                <span className="font-semibold text-white">{caixa.pesoAtual.toFixed(1)} / {caixa.tipo.pesoMax} kg</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Dimensões Ext:</span>
                                <span>{caixa.tipo.l}x{caixa.tipo.a}x{caixa.tipo.c} cm</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Quantidade Peças:</span>
                                <span className="font-semibold text-white">{caixa.itens.length} un.</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Visualização 3D e Planta 2D */}
                      <div className="xl:col-span-8 space-y-6">
                        
                        {/* Canvas Three.js */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-blue-500" /> Visualizador Digital Tridimensional (Rotacionável)
                            </h3>
                            <span className="text-xxs text-slate-500 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" /> Arraste para orbitar modelo
                            </span>
                          </div>

                          <div 
                            ref={canvasRef} 
                            className="w-full bg-slate-950 border border-slate-900 rounded-lg overflow-hidden relative cursor-grab active:cursor-grabbing"
                            style={{ height: '300px' }}
                          >
                            {!threeLoaded && (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando Renderizador 3D...
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Planta 2D com seletor de vista */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 gap-2">
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                              Planta de Disposição 2D (Fatiamento)
                            </h3>
                            
                            {/* Seletor de projeção */}
                            <div className="flex gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-md text-xxs font-semibold self-start sm:self-auto">
                              <button 
                                onClick={() => setModoProjecao('superior')}
                                className={`px-2.5 py-1 rounded transition-all ${modoProjecao === 'superior' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                              >
                                Vista Superior (Largura x Comprimento)
                              </button>
                              <button 
                                onClick={() => setModoProjecao('frontal')}
                                className={`px-2.5 py-1 rounded transition-all ${modoProjecao === 'frontal' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                              >
                                Vista Frontal (Largura x Altura)
                              </button>
                            </div>
                          </div>

                          {/* Renderização condicional da planta 2D */}
                          {(() => {
                            const caixaAtual = resultadoOtimizacao.caixas.find(c => c.id === caixaSelecionadaVisualizar);
                            if (!caixaAtual) return <div className="text-slate-500 text-xs py-10 text-center">Nenhuma caixa para renderização.</div>;

                            // Calcula dimensões baseado no modo de projeção
                            const boxW = caixaAtual.tipo.l; 
                            const boxH = modoProjecao === 'superior' ? caixaAtual.tipo.c : caixaAtual.tipo.a; 

                            const larguraVisualMax = 450;
                            const alturaVisualMax = 220;
                            const escala = Math.min(larguraVisualMax / boxW, alturaVisualMax / boxH);

                            const renderW = boxW * escala;
                            const renderH = boxH * escala;

                            return (
                              <div className="flex flex-col items-center justify-center py-4 bg-slate-950/80 rounded-lg">
                                {/* Container da planta */}
                                <div 
                                  className="border-2 border-slate-700 bg-slate-900/40 relative shadow-inner overflow-hidden transition-all duration-300"
                                  style={{ width: `${renderW}px`, height: `${renderH}px` }}
                                >
                                  {/* Renderiza cada item na posição calculada */}
                                  {caixaAtual.layout3D.map((pos, idx) => {
                                    const posX = pos.x * escala;
                                    const posY = (modoProjecao === 'superior' ? pos.z : pos.y) * escala;
                                    const larguraItem = pos.dx * escala;
                                    const alturaItem = (modoProjecao === 'superior' ? pos.dz : pos.dy) * escala;

                                    const isHovered = hoveredItemIndex === idx;

                                    return (
                                      <div
                                        key={pos.item.uid}
                                        onMouseEnter={() => setHoveredItemIndex(idx)}
                                        onMouseLeave={() => setHoveredItemIndex(null)}
                                        className="absolute border border-slate-950 text-white font-bold flex flex-col items-center justify-center cursor-pointer transition-all duration-150 rounded"
                                        style={{
                                          left: `${posX}px`,
                                          bottom: `${posY}px`, // Origem no canto inferior-esquerdo
                                          width: `${larguraItem}px`,
                                          height: `${alturaItem}px`,
                                          backgroundColor: pos.item.corBg,
                                          boxShadow: isHovered ? '0 0 12px rgba(255, 255, 255, 0.4) inset, 0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
                                          zIndex: isHovered ? 10 : 1,
                                          transform: isHovered ? 'scale(1.01)' : 'scale(1)'
                                        }}
                                        title={`${pos.item.nome} (${pos.dx}x${pos.dy}x${pos.dz} cm)`}
                                      >
                                        <span className="text-[9px] truncate max-w-full px-1 select-none">
                                          {larguraItem > 25 ? pos.item.nome.substring(0, 3).toUpperCase() : ''}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Legenda dos itens */}
                                <div className="mt-5 w-full border-t border-slate-800 pt-4">
                                  <h4 className="text-xxs font-bold text-slate-400 uppercase tracking-wider mb-2">Composição dos Itens na Caixa #{caixaAtual.id}:</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {caixaAtual.layout3D.map((pos, idx) => (
                                      <div 
                                        key={pos.item.uid}
                                        onMouseEnter={() => setHoveredItemIndex(idx)}
                                        onMouseLeave={() => setHoveredItemIndex(null)}
                                        className={`flex items-center justify-between p-1.5 rounded text-xs transition-all ${
                                          hoveredItemIndex === idx ? 'bg-slate-800 border-slate-700' : 'bg-transparent border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: pos.item.corBg }}></span>
                                          <span className="truncate text-slate-300 font-medium">{pos.item.nome}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">
                                          Dim: {pos.dx}x{pos.dy}x{pos.dz} cm
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================
                  ABA 3: PARAMETRIZAÇÃO DO SISTEMA
              ============================================================ */}
              {abaAtiva === 'configuracoes' && (
                <form onSubmit={salvarConfiguracoes} className="space-y-6">
                  
                  {/* Configuração do Contêiner */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Truck className="w-4 h-4" /> Dimensionamento do Contêiner Principal
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Identificação / Nome comercial</label>
                        <input 
                          type="text" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.nome}
                          onChange={e => setConfigTempContainer({...configTempContainer, nome: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Volume Admissível Máximo (m³)</label>
                        <input 
                          type="number" step="0.1" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.volumeMax}
                          onChange={e => setConfigTempContainer({...configTempContainer, volumeMax: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Largura Interna (cm)</label>
                        <input 
                          type="number" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.l}
                          onChange={e => setConfigTempContainer({...configTempContainer, l: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Altura Interna (cm)</label>
                        <input 
                          type="number" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.a}
                          onChange={e => setConfigTempContainer({...configTempContainer, a: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Comprimento (cm)</label>
                        <input 
                          type="number" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.c}
                          onChange={e => setConfigTempContainer({...configTempContainer, c: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Capacidade de Carga (kg)</label>
                        <input 
                          type="number" required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                          value={configTempContainer.pesoMax}
                          onChange={e => setConfigTempContainer({...configTempContainer, pesoMax: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Configuração dos Tipos de Caixa */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Box className="w-4 h-4" /> Modelos Disponíveis de Embalagens de Madeira
                    </h3>

                    <div className="space-y-4">
                      {editandoCaixas.map((c, idx) => (
                        <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-200">Tipo de Caixa: {c.nome} ({c.id})</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Largura (cm)</label>
                              <input 
                                type="number" required
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                                value={c.l}
                                onChange={e => {
                                  const nova = [...editandoCaixas];
                                  nova[idx].l = parseInt(e.target.value);
                                  nova[idx].volume = (nova[idx].l * nova[idx].a * nova[idx].c) / 1000000;
                                  setEditandoCaixas(nova);
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Altura (cm)</label>
                              <input 
                                type="number" required
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                                value={c.a}
                                onChange={e => {
                                  const nova = [...editandoCaixas];
                                  nova[idx].a = parseInt(e.target.value);
                                  nova[idx].volume = (nova[idx].l * nova[idx].a * nova[idx].c) / 1000000;
                                  setEditandoCaixas(nova);
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Comprimento (cm)</label>
                              <input 
                                type="number" required
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                                value={c.c}
                                onChange={e => {
                                  const nova = [...editandoCaixas];
                                  nova[idx].c = parseInt(e.target.value);
                                  nova[idx].volume = (nova[idx].l * nova[idx].a * nova[idx].c) / 1000000;
                                  setEditandoCaixas(nova);
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Peso Limite (kg)</label>
                              <input 
                                type="number" required
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                                value={c.pesoMax}
                                onChange={e => {
                                  const nova = [...editandoCaixas];
                                  nova[idx].pesoMax = parseInt(e.target.value);
                                  setEditandoCaixas(nova);
                                }}
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[10px] text-slate-500 mb-0.5">Volume (m³)</label>
                              <div className="w-full bg-slate-900/40 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-400 font-mono">
                                {c.volume.toFixed(3)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-800">
                    <button 
                      type="button"
                      onClick={restaurarPadroes}
                      className="w-full sm:w-auto text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800/40 px-4 py-2 rounded-lg transition-all"
                    >
                      Restaurar Padrões Industriais
                    </button>
                    <button 
                      type="submit"
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-xs py-2 px-6 rounded-lg transition-all shadow-md"
                    >
                      Salvar Novas Diretrizes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
