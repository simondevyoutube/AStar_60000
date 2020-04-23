import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';
import {BufferGeometryUtils} from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/utils/BufferGeometryUtils.js';
import {Sky} from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/objects/Sky.js';

import {agent} from './agent.js';
import {astar} from './astar.js';
import {game} from './game.js';
import {math} from './math.js';
import {mazegen} from './mazegen.js';


const _BOID_SPEED = 0.25;
const _BOID_ACCELERATION = _BOID_SPEED / 2.5;
const _BOID_FORCE_MAX = _BOID_ACCELERATION / 5.0;

const _TILES_X = 500;
const _TILES_Y = 20;
const _TILES_S = 50;

let _APP = null;


function _Key(x, y) {
  return x + '.' + y;
}

function _ManhattanDistance(n1, n2) {
  const p1 = n1.metadata.position;
  const p2 = n2.metadata.position;
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  return (dx + dy);
}

function _Distance(n1, n2) {
  const p1 = n1.metadata.position;
  const p2 = n2.metadata.position;
  return p1.distanceTo(p2);
}

class Graph {
  constructor() {
    this._nodes = {};
  }

  get Nodes() {
    return this._nodes;
  }

  AddNode(k, e, m) {
    this._nodes[k] = {
      edges: [...e],
      potentialEdges: [...e],
      metadata: m
    };
  }
}

function NodesToMesh(scene, nodes) {
  const material = new THREE.MeshStandardMaterial({color: 0x71b5ef});
  const material2 = new THREE.MeshStandardMaterial({color: 0xFFFFFF});

  const edges = {};
  const geometries = [];

  for (const k in nodes) {
    const curNode = nodes[k];
    const x = curNode.metadata.position.x;
    const y = curNode.metadata.position.y;
    const w = 1;
    const h = 1;
    const wallWidth = 0.25;
    const wallHeight = 0.5;

    const neighbours = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    if (!curNode.metadata.render.visible) {
      continue;
    }

    for (let ni = 0; ni < neighbours.length; ni++) {
      const n = neighbours[ni];
      const ki = _Key(x + n[0], y + n[1]);

      if (curNode.edges.indexOf(_Key(x, y + 1)) < 0) {
        // this._gfx.moveTo(w * (x + 0.0), h * (y + 1.0));
        // this._gfx.lineTo(w * (x + 1.0), h * (y + 1.0));
        const x1 = w * (x + 0.0);
        const y1 = h * (y + 1.0);
        const x2 = w * (x + 1.0);
        const y2 = h * (y + 1.0);

        const sq = new THREE.BoxBufferGeometry(x2 - x1, wallHeight, wallWidth);
        const m = new THREE.Matrix4();
        m.makeTranslation(x1 + 0.5, wallHeight * 0.5, y1);
        sq.applyMatrix(m);
        geometries.push(sq);
      }

      if (curNode.edges.indexOf(_Key(x + 1, y + 0)) < 0) {
        // this._gfx.moveTo(w * (x + 1.0), h * (y + 0.0));
        // this._gfx.lineTo(w * (x + 1.0), h * (y + 1.0));
        const x1 = w * (x + 1.0);
        const y1 = h * (y + 0.0);
        const x2 = w * (x + 1.0);
        const y2 = h * (y + 1.0);

        const sq = new THREE.BoxBufferGeometry(wallWidth, wallHeight, y2 - y1);
        const m = new THREE.Matrix4();
        m.makeTranslation(x1, wallHeight * 0.5, y1 + 0.5);
        sq.applyMatrix(m);
        geometries.push(sq);
      }

      if (curNode.edges.indexOf(_Key(x, y - 1)) < 0) {
        // this._gfx.moveTo(w * (x + 0.0), h * (y + 0.0));
        // this._gfx.lineTo(w * (x + 1.0), h * (y + 0.0));
        const x1 = w * (x + 0.0);
        const y1 = h * (y + 0.0);
        const x2 = w * (x + 1.0);
        const y2 = h * (y + 0.0);

        const sq = new THREE.BoxBufferGeometry(x2 - x1, wallHeight, wallWidth);
        const m = new THREE.Matrix4();
        m.makeTranslation(x1 + 0.5, wallHeight * 0.5, y1);
        sq.applyMatrix(m);
        geometries.push(sq);
      }

      if (curNode.edges.indexOf(_Key(x - 1, y)) < 0) {
        // this._gfx.moveTo(w * (x + 0.0), h * (y + 0.0));
        // this._gfx.lineTo(w * (x + 0.0), h * (y + 1.0));
        const x1 = w * (x + 0.0);
        const y1 = h * (y + 0.0);
        const x2 = w * (x + 0.0);
        const y2 = h * (y + 1.0);

        const sq = new THREE.BoxBufferGeometry(wallWidth, wallHeight, y2 - y1);
        const m = new THREE.Matrix4();
        m.makeTranslation(x1, wallHeight * 0.5, y1 + 0.5);
        sq.applyMatrix(m);
        geometries.push(sq);
      }
    }
  }

  for (const k in nodes) {
    const curNode = nodes[k];
    curNode.edges = [...new Set(curNode.edges)];
  }

  const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(
    geometries, false);
  const mesh = new THREE.Mesh(mergedGeometry, material2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 1, 1), material);
  plane.position.set(0, 0, 0);
  plane.castShadow = false;
  plane.receiveShadow = true;
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);
}

class Demo extends game.Game {
  constructor() {
    super();
  }

  _OnInitialize() {
    this._entities = [];
    this._controls.panningMode = 1;

    this._CreateMaze();
    this._LoadBackground();
  }

  _LoadBackground() {
    this._sky = new Sky();
    this._sky.scale.setScalar(10000);
    this._graphics.Scene.add(this._sky);

    const sky = {
      turbidity: 10.0,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      luminance: 1,
    };

    const sun = {
      inclination: 0.31,
      azimuth: 0.25,
    };

    for (let k in sky) {
      this._sky.material.uniforms[k].value = sky[k];
    }

    const theta = Math.PI * (sun.inclination - 0.5);
    const phi = 2 * Math.PI * (sun.azimuth - 0.5);

    const sunPosition = new THREE.Vector3();
    sunPosition.x = Math.cos(phi);
    sunPosition.y = Math.sin(phi) * Math.sin(theta);
    sunPosition.z = Math.sin(phi) * Math.cos(theta);

    this._sky.material.uniforms['sunPosition'].value.copy(sunPosition);
  }

  _CreateMaze() {
    this._graph = new Graph();

    for (let x = 0; x < _TILES_X; x++) {
      for (let y = 0; y < _TILES_Y; y++) {
        const k = _Key(x, y);
        this._graph.AddNode(
            k, [],
            {
              position: new THREE.Vector2(x, y),
              weight: 0,
              render: {
                visited: false,
                visible: true,
              }
            });
      }
    }

    for (let x = 0; x < _TILES_X; x++) {
      for (let y = 0; y < _TILES_Y; y++) {
        const k = _Key(x, y);

        for (let xi = -1; xi <= 1; xi++) {
          for (let yi = -1; yi <= 1; yi++) {
            if (xi == 0 && yi == 0 || (Math.abs(xi) + Math.abs(yi) != 1)) {
              continue;
            }

            const ki = _Key(x + xi, y + yi);

            if (ki in this._graph.Nodes) {
              this._graph.Nodes[k].potentialEdges.push(ki);
            }
          }
        }
      }
    }

    const start = _Key(0, 0);
    const end = _Key(4, 0);

    this._mazeGenerator = new mazegen.MazeGenerator(this._graph.Nodes);
    this._mazeIterator = this._mazeGenerator.GenerateIteratively(start);
    this._mazeDone = () => {
      const nodes = [];
      for (let x = 0; x < _TILES_X; x++) {
        for (let y = 0; y > -_TILES_S; y--) {
          const k = _Key(x, y);
          if (k in this._graph.Nodes) {
            continue;
          }
          this._graph.AddNode(
              k, [],
              {
                position: new THREE.Vector2(x, y),
                weight: 0,
                render: {
                  visited: false,
                  visible: false,
                }
              });
          nodes.push(k);
        }
      }
      for (let x = 0; x < _TILES_X; x++) {
        for (let y = _TILES_Y - 1; y < _TILES_Y + _TILES_S; y++) {
          const k = _Key(x, y);
          if (k in this._graph.Nodes) {
            continue;
          }
          this._graph.AddNode(
              k, [],
              {
                position: new THREE.Vector2(x, y),
                weight: 0,
                render: {
                  visited: false,
                  visible: false,
                }
              });
          nodes.push(k);
        }
      }
      for (let k of nodes) {
        const n = this._graph.Nodes[k];
        const x = n.metadata.position.x;
        const y = n.metadata.position.y;

        for (let xi = -1; xi <= 1; xi++) {
          for (let yi = -1; yi <= 1; yi++) {
            if (xi == 0 && yi == 0 || (Math.abs(xi) + Math.abs(yi) != 1)) {
              continue;
            }

            const ki = _Key(x + xi, y + yi);

            if (ki in this._graph.Nodes) {
              this._graph.Nodes[k].potentialEdges.push(ki);
            }

            for (let pk of this._graph.Nodes[k].potentialEdges) {
              this._graph.Nodes[k].edges.push(pk);
              this._graph.Nodes[pk].edges.push(k);
            }
          }
        }
      }

      this._CreateEntities();
    };
  }

  _CreateEntities() {
    const geometries = {
      cone: new THREE.ConeGeometry(1, 2, 32)
    };

    const material = new THREE.MeshStandardMaterial({color: 0xFF0000});
    const numInstances = _TILES_X * _TILES_S / 2;

    const mesh = new THREE.InstancedMesh(
        geometries.cone, material, numInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    let index = 0;
    const nodes = this._graph.Nodes;

    function _ManhattanDistance(n1, n2) {
      const p1 = n1.metadata.position;
      const p2 = n2.metadata.position;
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      return (dx + dy);
    }
    
    function _Distance(n1, n2) {
      const p1 = n1.metadata.position;
      const p2 = n2.metadata.position;
      return p1.distanceTo(p2);
    }

    const heuristicFunction = (s, e) => {
      return 2 * _ManhattanDistance(nodes[s], nodes[e]);
    };

    const weightFunction = (s, e) => {
      return _ManhattanDistance(nodes[s], nodes[e]);
    };

    const mgr = new astar.AStarManager(
        this._graph.Nodes,
        heuristicFunction,
        weightFunction);

    this._entities.push(mgr);

    for (let j = 0; j < _TILES_S / 2; j++) {
      for (let i = 0; i < _TILES_X; i++) {
        const xe = math.clamp(math.rand_int(i - 20, i + 20), 0, _TILES_X - 1);
        const start = _Key(i, -j - 1);
        const end = _Key(xe, _TILES_Y + 5);
    
        let params = {
          geometry: geometries.cone,
          material: material,
          mesh: mesh,
          index: index++,
          speed: _BOID_SPEED,
          maxSteeringForce: _BOID_FORCE_MAX,
          acceleration: _BOID_ACCELERATION,
          position: new THREE.Vector3(i, 0.25, -j - 1),
          astar: mgr.CreateClient(start, end),
        };
        const e = new agent.Agent_Instanced(this, params);
        this._entities.push(e);
      }
    }

    this._graphics._camera.position.set(_TILES_X / 2, 7, 12);
    this._controls.target.set(_TILES_X / 2, 0, -5);
    this._controls.update();

    console.log('AGENTS: ' + this._entities.length)

    this._graphics.Scene.add( mesh );
  }

  _OnStep(timeInSeconds) {
    timeInSeconds = Math.min(timeInSeconds, 1 / 10.0);

    this._StepMazeGeneration();
    this._StepEntities(timeInSeconds);
  }

  _StepMazeGeneration() {
    for (let i = 0; i < 100; i++) {
      if (this._mazeIterator) {
        const r = this._mazeIterator.next();
        if (r.done) {
          console.log('DONE');
          this._mazeGenerator.Randomize();
          this._mazeDone();
          NodesToMesh(this._graphics.Scene, this._graph.Nodes);
          this._graphics._shadowLight.position.set(_TILES_X * 0.5, 10, _TILES_Y * 0.5);
          this._graphics._shadowLight.target.position.set(_TILES_X * 0.5 - 5, 0, _TILES_Y * 0.5 - 5);
          this._graphics._shadowLight.target.updateWorldMatrix();
          this._mazeIterator = null;
        }
      }
    }
  }

  _StepEntities(timeInSeconds) {
    for (let e of this._entities) {
      e.Step(timeInSeconds);
    }
  }
}


function _Main() {
  _APP = new Demo();
}

_Main();
