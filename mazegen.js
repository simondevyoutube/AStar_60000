export const mazegen = (function() {

  function RouletteSelect(src) {
    const roll = Math.random() * src.length;

    let sum = 0;
    for (let i = 0; i < src.length; i++) {
      sum += 1.0;
      if (roll < sum) {
        const res = src[i];
        src = src.splice(i, 1);
        return res;
      }
    }
  }

  function _Key(x, y) {
    return x + '.' + y;
  }

  return {
    MazeGenerator: class {
      constructor(nodes) {
        this._nodes = nodes;
        this._visited = {};
      }

      *GenerateIteratively(nodeKey) {
        this._visited[nodeKey] = true;

        const node = this._nodes[nodeKey];

        const neighbours = [...node.potentialEdges];
        while (neighbours.length > 0) {
          const ki = RouletteSelect(neighbours);

          if (!(ki in this._visited)) {
            const adjNode = this._nodes[ki];

            node.edges.push(ki);
            adjNode.edges.push(nodeKey);

            yield* this.GenerateIteratively(ki);
          }
        }
      }

      Randomize() {
        for (let k in this._nodes) {
          const n = this._nodes[k];
          if (n.potentialEdges < 3) {
            continue;
          }

          const neighbours = [...n.potentialEdges];
          while (n.edges.length < 3) {
            const ki = RouletteSelect(neighbours);

            if (!(ki in n.edges)) {
              const adjNode = this._nodes[ki];
  
              n.edges.push(ki);
              adjNode.edges.push(k);
            }    
          }
        }
      }

      GenerateMaze(start) {
        this._ProcessNode(start);
      }

      _ProcessNode(nodeKey) {
        this._visited[nodeKey] = true;

        const node = this._nodes[nodeKey];

        const neighbours = [...node.potentialEdges];
        while (neighbours.length > 0) {
          const ki = RouletteSelect(neighbours);

          if (!(ki in this._visited)) {
            const adjNode = this._nodes[ki];

            node.edges.push(ki);
            adjNode.edges.push(nodeKey);
            this._ProcessNode(ki);
          }
        }
      }
    }
  };
})();
