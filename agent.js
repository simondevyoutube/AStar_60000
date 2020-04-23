import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';

import {math} from './math.js';


export const agent = (function() {

  const _BOID_FORCE_ORIGIN = 5;

  const _M = new THREE.Matrix4();
  const _V = new THREE.Vector3();
  const _A = new THREE.Vector2();
  const _B = new THREE.Vector2();
  const _AP = new THREE.Vector2();
  const _AB = new THREE.Vector2();
  const _BA = new THREE.Vector2();
  const _PT2 = new THREE.Vector2();
  const _PT3 = new THREE.Vector3();

  const _Q = new THREE.Quaternion();
  const _V_0 = new THREE.Vector3(0, 0, 0);
  const _V_Y = new THREE.Vector3(0, 1, 0);
  const _V_SC_0_1 = new THREE.Vector3(0.1, 0.1, 0.1);

  function _Key(x, y) {
    return x + '.' + y;
  }
  
  class LineRenderer {
    constructor(game) {
      this._game = game;
  
      this._materials = {};
      this._group = new THREE.Group();
  
      this._game._graphics.Scene.add(this._group);
    }
  
    Reset() {
      this._lines = [];
      this._group.remove(...this._group.children);
    }
  
    Add(pt1, pt2, hexColour) {
      const geometry = new THREE.Geometry();
      geometry.vertices.push(pt1.clone());
      geometry.vertices.push(pt2.clone());
  
      let material = this._materials[hexColour];
      if (!material) {
        this._materials[hexColour] = new THREE.LineBasicMaterial(
            {
              color: hexColour,
              linewidth: 3,
            });
        material = this._materials[hexColour];
      }
  
      const line = new THREE.Line(geometry, material);
      this._lines.push(line);
      this._group.add(line);
    }
  }
  

  class _Agent_Base {
    constructor(game, params) {
      this._direction = new THREE.Vector3(1, 0, 0);
      this._velocity = new THREE.Vector3(0, 0, 0);

      this._maxSteeringForce = params.maxSteeringForce;
      this._maxSpeed  = params.speed;
      this._acceleration = params.acceleration;

      this._game = game;

      this._astar = params.astar;
      this._pathNodes = [];

      this._wanderAngle = 0;

      this._displayDebug = false;

      this._InitDebug();
    }

    _InitDebug() {
      if (!this._displayDebug) {
        return;
      }

      const e = this._astar._nodes[this._astar._end].metadata.position;
      const endPosition = new THREE.Vector3(e.x, 1, e.y);

      const geometry = new THREE.SphereGeometry(1, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: 0x80FF80,
        transparent: true,
        opacity: 0.25,
      });
      const mesh = new THREE.Mesh(geometry, material);
      this._goalMesh = mesh;
      this._goalMesh.position.copy(endPosition);
  
      this._displayDebug = true;
      this._lineRenderer = new LineRenderer(this._game);
      this._lineRenderer.Reset();
    }

    _UpdateDebug() {
      if (!this._displayDebug) {
        return;
      }
      this._lineRenderer.Reset();
      this._UpdateDebugPath();
    }

    _UpdateDebugPath() {
      if (!this._displayDebug) {
        return;
      }
      const path = this._pathNodes;
      for (let i = 0; i < path.length - 1; i++) {

        const _AsV3 = (p) => {
          const pos = p.metadata.position;
          return new THREE.Vector3(pos.x + 0.5, 0.25, pos.y + 0.5);
        }

        const p1 = _AsV3(path[i]);
        const p2 = _AsV3(path[i+1]);

        this._lineRenderer.Add(p1, p2, 0xFF0000);
      }
    }

    get Position() {
      return this._group.position;
    }

    get Velocity() {
      return this._velocity;
    }

    get Direction() {
      return this._direction;
    }

    get Radius() {
      return this._radius;
    }

    Step(timeInSeconds) {
      if (this._astar) {
        if (this._astar.finished) {
          this._pathNodes = this._astar.Path;
          this._astar = null;
        } else if (!this._astar.started) {
          this._UpdateSearchStartPosition();
        }
      }

      this._ApplySteering(timeInSeconds);
      this._OnStep(timeInSeconds);
    }

    _UpdateSearchStartPosition() {
      const p = this.Position;
      const a = _A.set(p.x, p.z);
      const k = _Key(Math.floor(a.x), Math.floor(a.y));

      this._astar._start = k; 
    }

    _ApplySteering(timeInSeconds) {
      const forces = [
        this._ApplyPathFollowing(),
      ];

      const steeringForce = new THREE.Vector3(0, 0, 0);
      for (const f of forces) {
        steeringForce.add(f);
      }

      steeringForce.multiplyScalar(this._acceleration * timeInSeconds);

      // Lock movement to x/z dimension
      steeringForce.multiply(new THREE.Vector3(1, 0, 1));

      // Clamp the force applied
      if (steeringForce.length() > this._maxSteeringForce) {
        steeringForce.normalize();
        steeringForce.multiplyScalar(this._maxSteeringForce);
      }

      this._velocity.add(steeringForce);

      // Clamp velocity
      if (this._velocity.length() > this._maxSpeed) {
        this._velocity.normalize();
        this._velocity.multiplyScalar(this._maxSpeed);
      }

      this._direction.copy(this._velocity);
      this._direction.normalize();
    }

    _ApplyPartialPathFollowing() {
      if (!this._astar) {
        return _V_0;
      }

      const end = _A.copy(this._astar._nodes[this._astar._end].metadata.position);
      end.addScalar(0.5);

      _PT3.set(end.x, this.Position.y, end.y);

      return this._ApplySeek(_PT3);
    }

    _ApplyPathFollowing() {
      if (this._pathNodes.length < 2) {
        return this._ApplyPartialPathFollowing();
      }

      const _PointOnLine = (p, a, b) => {
        _AP.subVectors(p, a);
        _AB.subVectors(b, a);

        const maxLength = _AB.length();
        const dp = math.clamp(_AP.dot(_AB), 0, maxLength);

        _AB.normalize();
        _AB.multiplyScalar(dp);

        return _AB.add(a);
      }

      const p = this.Position;
      _PT2.set(p.x, p.z);

      const a = _A.copy(this._pathNodes[0].metadata.position);
      const b = _B.copy(this._pathNodes[1].metadata.position);

      a.addScalar(0.5);
      b.addScalar(0.5);

      const pt = _PointOnLine(_PT2, a, b);
      _BA.subVectors(b, a).normalize();
      pt.add(_BA.multiplyScalar(0.1));

      _PT3.set(pt.x, p.y, pt.y);

      if (this._displayDebug) {
        this._lineRenderer.Add(p, _PT3, 0x00FF00);
      }

      if (p.distanceTo(_PT3) < 0.25) {
        this._pathNodes.shift();
      }

      return this._ApplySeek(_PT3);
    }

    _ApplySeek(destination) {
      const direction = destination.clone().sub(this.Position);
      direction.normalize();

      const forceVector = direction.multiplyScalar(_BOID_FORCE_ORIGIN);
      return forceVector;
    }
  }

  class _Agent_Mesh extends _Agent_Base {
    constructor(game, params) {
      super(game, params);

      this._mesh = new THREE.Mesh(params.geometry, params.material);
      this._mesh.castShadow = true;
      this._mesh.receiveShadow = true;
      this._mesh.scale.setScalar(0.1);
      this._mesh.rotateX(-Math.PI / 2);

      this._group = new THREE.Group();
      this._group.add(this._mesh);
      this._group.position.copy(params.position);

      game._graphics.Scene.add(this._group);
    }

    _OnStep(timeInSeconds) {
      const frameVelocity = this._velocity.clone();
      frameVelocity.multiplyScalar(timeInSeconds);
      this._group.position.add(frameVelocity);
  
      const direction = this.Direction;
      const m = new THREE.Matrix4();
      m.lookAt(
          new THREE.Vector3(0, 0, 0),
          direction,
          new THREE.Vector3(0, 1, 0));
      this._group.quaternion.setFromRotationMatrix(m);
    }
  }

  class _Agent_Instanced extends _Agent_Base {
    constructor(game, params) {
      super(game, params);

      this._mesh = params.mesh;

      this._proxy = new THREE.Object3D();
      this._proxy.scale.setScalar(0.1);
      this._proxy.rotateX(-Math.PI / 2);

      this._group = new THREE.Object3D();
      this._group.position.copy(params.position);
      this._group.add(this._proxy);

      this._index = params.index;
    }

    _OnStep(timeInSeconds) {
      const frameVelocity = this._velocity.clone();
      frameVelocity.multiplyScalar(timeInSeconds);
      this._group.position.add(frameVelocity);
  
      _M.lookAt(_V_0, this._direction, _V_Y);
      this._group.quaternion.setFromRotationMatrix(_M);
      this._group.updateMatrixWorld();
      this._proxy.updateMatrixWorld();
      this._mesh.setMatrixAt(this._index, this._proxy.matrixWorld);
      this._mesh.instanceMatrix.needsUpdate = true;
    }
  }

  class _Agent_Instanced_Faster extends _Agent_Base {
    constructor(game, params) {
      super(game, params);

      this._mesh = params.mesh;

      this._position = new THREE.Vector3();
      this._position.copy(params.position);

      this._index = params.index;
    }

    get Position() {
      return this._position;
    }

    _OnStep(timeInSeconds) {
      const frameVelocity = _V.copy(this._velocity);
      frameVelocity.multiplyScalar(timeInSeconds);
      this._position.add(frameVelocity);

      _Q.setFromUnitVectors(_V_Y, this._direction);
      _M.identity();
      _M.compose(this._position, _Q, _V_SC_0_1);
      
      this._mesh.setMatrixAt(this._index, _M);
      this._mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    Agent: _Agent_Mesh,
    Agent_Instanced: _Agent_Instanced_Faster
  };
})();
