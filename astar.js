export const astar = (function() {

  class _OpenSet {
    constructor() {
      this._priorityQueue = buckets.PriorityQueue((a, b) => {
        if (a.fScore > b.fScore) {
          return -1;
        }
        if (a.fScore < b.fScore) {
          return 1;
        }
        if (a.gScore > b.gScore) {
          return 1;
        }
        if (a.gScore < b.gScore) {
          return -1;
        }
        return 0;
      });
      this._dict = {};
    }

    add(k, v) {
      this._priorityQueue.add(v);
      this._dict[k] = true;
    }

    dequeue() {
      const v = this._priorityQueue.dequeue();
      delete this._dict[v.key];
      return v;
    }

    peek() {
      return this._priorityQueue.peek();
    }

    hasKey(k) {
      return (k in this._dict);
    }

    size() {
      return this._priorityQueue.size();
    }
  };

  class _AStarClient {
    constructor(start, end, nodes) {
      this._start = start;
      this._end = end;
      this._nodes = nodes;
      this._path = null;
      this._astarInstance = null;
    }

    Start(instance) {
      this._astarInstance = instance;
    }

    get Path() {
      return this._path;
    }

    get started() {
      return this._astarInstance != null;
    }

    get finished() {
      if (this._path) {
        return true;
      }

      if (!this._astarInstance) {
        return false;
      }

      return this._astarInstance.finished;
    }

    CachePath() {
      if (!this._astarInstance) {
        return null;
      }

      this._path = this._astarInstance.BuildPath();
      this._path = this._path.map(k => this._astarInstance._nodes[k])
      this._astarInstance = null;
    }

    Step() {
      if (!this._astarInstance) {
        return;
      }

      this._astarInstance.Step();
    }
  };

  const _MAX_ASTAR = 400;

  class _AStarManager {
    constructor(nodes, costFunction, weightFunction) {
      this._nodes = nodes;
      this._costFunction = costFunction;
      this._weightFunction = weightFunction;
      this._live = [];
      this._clients = [];
    }

    Step() {
      for (let c of this._clients) {
        if (!c._astarInstance && !c.finished && this._live.length < _MAX_ASTAR) {
          const a = new _AStar(this._nodes, c._start, c._end, this._costFunction, this._weightFunction);
          c.Start(a);
          this._live.push(c);
        }
      }

      for (let c of this._live) {
        c.Step();
        if (c.finished) {
          c.CachePath();
        }
      }

      this._live = this._live.filter(c => !c.finished);
    }

    CreateClient(start, end) {
      const c = new _AStarClient(start, end, this._nodes);
      this._clients.push(c);

      return c;
    }
  }

  class _AStar {
    constructor(nodes, start, end, costFunction, weightFunction) {
      this._start = start;
      this._end = end;
      this._nodes = nodes;
      this._costFunction = costFunction;
      this._weightFunction = weightFunction;
      this._finished = false;
      this._steps = 0;

      this._data = {};
      this._data[start] = {
        key: start,
        gScore: 0,
        fScore: costFunction(start, end),
        cameFrom: null,
      };

      this._open = new _OpenSet();
      this._open.add(start, this._data[start]);
    }

    get finished() {
      return this._finished;
    }

    BuildInProgressPath() {
      const lowestF = this._open.peek();

      const path = [lowestF.key];

      while (true) {
        const n = this._data[path[path.length - 1]];

        if (n.cameFrom == null) {
          break;
        }

        path.push(n.cameFrom);
      }
      return path.reverse();
    }

    BuildPath() {
      if (!this.finished) {
        return this.BuildInProgressPath();
      }

      const path = [this._end];

      while (true) {
        const n = this._data[path[path.length - 1]];

        if (n.cameFrom == null) {
          break;
        }

        path.push(n.cameFrom);
      }
      return path.reverse();
    }

    Step() {
      if (this.finished) {
        return;
      }

      if (this._open.size() > 0) {
        this._steps += 1;

        const curNode = this._open.dequeue();
        const k = curNode.key;

        if (k == this._end) {
          this._finished = true;
          return;
        }

        for (const e of this._nodes[k].edges) {
          // Lazily instantiate graph instead of in constructor.
          if (!(e in this._data)) {
            this._data[e] = {
              key: k,
              gScore: Number.MAX_VALUE,
              fScore: Number.MAX_VALUE,
              cameFrom: null,
            };
          }
         
          const gScore = this._data[k].gScore + this._weightFunction(k, e);
          if (gScore < this._data[e].gScore) {
            this._data[e] = {
              key: e,
              gScore: gScore,
              fScore: gScore + this._costFunction(this._end, e),
              cameFrom: k,
            };
            if (!this._open.hasKey(e)) {
              this._open.add(e, this._data[e]);
            }
          }
        }
      }
    }
  };

  return {
    AStarManager: _AStarManager,
  };
})();