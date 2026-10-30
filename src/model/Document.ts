import { Group } from "./Group";
import { ModelError } from "./ModelError";
import { ModelValue } from "./ModelValue";
import { Shape } from "./Shape";
import { SvgNode } from "./SvgNode";

export class Document {
  #width: number;
  #height: number;
  #roots: readonly Shape[] = Object.freeze([]);
  #idIndex = new Map<string, Shape>();
  #parentIndex = new Map<string, { parentId: string | null; position: number }>();

  constructor(width = 800, height = 600, roots: readonly Shape[] = []) {
    this.#width = ModelValue.positive(width, "canvas width");
    this.#height = ModelValue.positive(height, "canvas height");
    // Reject invalid input before cloning, including shared nodes and ids.
    Document.index(roots);
    this.commit(roots.map(shape => shape.clone()));
  }

  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get size(): number { return this.#idIndex.size; }
  getRoots(): readonly Shape[] { return this.#roots; }

  find(id: string): Shape {
    const shape = this.#idIndex.get(id);
    if (!shape) throw new ModelError(`no such shape: ${id}`);
    return shape;
  }

  getParentId(id: string): string | null {
    this.find(id);
    return this.#parentIndex.get(id)!.parentId;
  }

  getPosition(id: string): number {
    this.find(id);
    return this.#parentIndex.get(id)!.position;
  }

  insert(shape: Shape, containerId: string | null = null): Shape {
    this.container(containerId);
    const incoming = Document.index([shape]).ids;
    for (const id of incoming.keys()) {
      if (this.#idIndex.has(id)) throw new ModelError(`id already exists: ${id}`);
    }
    // Ownership boundary: later edits to the input object cannot change this tree.
    const owned = shape.clone();
    this.commit(this.transform((parent, children) =>
      parent === containerId ? [...children, owned] : children));
    return this.find(owned.id);
  }

  delete(id: string): void {
    this.find(id);
    this.commit(this.transform((_parent, children) => children.filter(child => child.id !== id)));
  }

  group(newId: string, ids: readonly string[]): Group {
    ModelValue.id(newId);
    if (this.#idIndex.has(newId)) throw new ModelError(`id already exists: ${newId}`);
    if (ids.length === 0) throw new ModelError("group requires at least one shape");
    const selected = new Set<string>();
    for (const id of ids) {
      this.find(id);
      if (selected.has(id)) throw new ModelError(`duplicate group id: ${id}`);
      selected.add(id);
    }
    // Reject any selected ancestor/descendant pair before constructing the group.
    for (const id of ids) {
      for (const ancestor of this.ancestors(id)) {
        if (ancestor !== null && selected.has(ancestor)) {
          throw new ModelError(`cannot group a container into its own descendant: ${ancestor}`);
        }
      }
    }
    const chains = ids.map(id => this.ancestors(id));
    const parent = chains[0].find(candidate => chains.every(chain => chain.includes(candidate))) ?? null;
    // Map insertion order is the pre-edit depth-first drawing order.
    const ordered = [...this.#idIndex.values()].filter(shape => selected.has(shape.id));
    const group = new Group(newId, ordered);
    let anchor = ordered[0].id;
    while (this.getParentId(anchor) !== parent) anchor = this.getParentId(anchor)!;
    this.commit(this.transform((parentId, children) => {
      const result: Shape[] = [];
      for (const child of children) {
        if (parentId === parent && child.id === anchor) result.push(group);
        if (!selected.has(child.id)) result.push(child);
      }
      return result;
    }));
    return this.find(newId) as Group;
  }

  ungroup(id: string): void {
    const group = this.container(id)!;
    const parent = this.getParentId(id);
    if (parent === null) throw new ModelError(`cannot ungroup top-level container: ${id}`);
    this.commit(this.transform((parentId, children) => parentId === parent
      ? children.flatMap(child => child.id === id ? [...group.getChildren()] : [child])
      : children));
  }

  addTo(groupId: string, id: string): void {
    this.container(groupId);
    const shape = this.find(id);
    if (groupId === id || this.ancestors(groupId).includes(id)) {
      throw new ModelError(`cannot add a container into its own descendant: ${id}`);
    }
    this.commit(this.transform((parent, children) => {
      const remaining = children.filter(child => child.id !== id);
      return parent === groupId ? [...remaining, shape] : remaining;
    }));
  }

  bringToFront(id: string): void { this.reorder(id, true); }
  sendToBack(id: string): void { this.reorder(id, false); }

  resize(width: number, height: number): void {
    const nextWidth = ModelValue.positive(width, "canvas width");
    const nextHeight = ModelValue.positive(height, "canvas height");
    this.#width = nextWidth;
    this.#height = nextHeight;
  }

  clone(): Document { return new Document(this.#width, this.#height, this.#roots); }

  toSvgNode(): SvgNode {
    return Object.freeze({ tag: "svg", attributes: Object.freeze({
      xmlns: "http://www.w3.org/2000/svg", width: this.width, height: this.height,
      viewBox: `0 0 ${this.width} ${this.height}`,
    }), children: Object.freeze(this.#roots.map(shape => shape.toSvgNode())) });
  }

  validate(): void {
    ModelValue.positive(this.width, "canvas width");
    ModelValue.positive(this.height, "canvas height");
    const rebuilt = Document.index(this.#roots);
    if (rebuilt.ids.size !== this.#idIndex.size || rebuilt.parents.size !== this.#parentIndex.size) {
      throw new ModelError("inconsistent document index");
    }
    for (const [id, shape] of rebuilt.ids) {
      const actual = this.#parentIndex.get(id);
      const expected = rebuilt.parents.get(id)!;
      if (this.#idIndex.get(id) !== shape || actual?.parentId !== expected.parentId ||
          actual?.position !== expected.position) throw new ModelError("inconsistent document index");
    }
  }

  private container(id: string | null): Group | null {
    if (id === null) return null;
    const shape = this.#idIndex.get(id);
    if (!shape) throw new ModelError(`no such container: ${id}`);
    if (!(shape instanceof Group)) throw new ModelError(`not a container: ${id}`);
    return shape;
  }

  private ancestors(id: string): (string | null)[] {
    const result: (string | null)[] = [];
    let parent = this.getParentId(id);
    while (parent !== null) {
      result.push(parent);
      parent = this.getParentId(parent);
    }
    result.push(null);
    return result;
  }

  private reorder(id: string, front: boolean): void {
    const shape = this.find(id);
    const parent = this.getParentId(id);
    this.commit(this.transform((parentId, children) => {
      if (parentId !== parent) return children;
      const rest = children.filter(child => child.id !== id);
      return front ? [...rest, shape] : [shape, ...rest];
    }));
  }

  /** Rebuild membership without exposing a mutator or changing the live tree. */
  private transform(edit: (parent: string | null, children: readonly Shape[]) => readonly Shape[]): readonly Shape[] {
    const visit = (parent: string | null, children: readonly Shape[]): readonly Shape[] => {
      const rebuilt = children.map(child => {
        if (!(child instanceof Group)) return child;
        const next = visit(child.id, child.getChildren());
        return next.length === child.getChildren().length && next.every((item, i) => item === child.getChildren()[i])
          ? child : child.withChildren(next);
      });
      return edit(parent, rebuilt);
    };
    return visit(null, this.#roots);
  }

  private commit(roots: readonly Shape[]): void {
    const { ids, parents } = Document.index(roots);
    const nextRoots = Object.freeze([...roots]);
    this.#roots = nextRoots;
    this.#idIndex = ids;
    this.#parentIndex = parents;
  }

  private static index(roots: readonly Shape[]): {
    ids: Map<string, Shape>;
    parents: Map<string, { parentId: string | null; position: number }>;
  } {
    const ids = new Map<string, Shape>();
    const parents = new Map<string, { parentId: string | null; position: number }>();
    const visiting = new Set<Shape>();
    const visit = (children: readonly Shape[], parentId: string | null): void => {
      children.forEach((shape, position) => {
        if (visiting.has(shape)) throw new ModelError(`cyclic shape tree: ${shape.id}`);
        if (ids.has(shape.id)) throw new ModelError(`id already exists: ${shape.id}`);
        ModelValue.id(shape.id);
        ids.set(shape.id, shape);
        parents.set(shape.id, { parentId, position });
        visiting.add(shape);
        if (shape instanceof Group) visit(shape.getChildren(), shape.id);
        visiting.delete(shape);
      });
    };
    visit(roots, null);
    return { ids, parents };
  }
}
