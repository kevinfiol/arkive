let NIL = void 0,
  REDRAWS = [],
  isArray = Array.isArray,
  isStr = x => typeof x === 'string',
  isFn = x => typeof x === 'function',
  isObj = x => x !== null && typeof x === 'object';

let createNode = v => document[v._cmp ? 'createElement' : 'createTextNode'](v.tag || v);

let addChildren = (x, children) => {
  if (isArray(x)) for (let i = 0; i < x.length; i++) addChildren(x[i], children);
  else if (x != null && x !== false) children.push(x);
};

let styles = (obj) => {
  let str = '';
  for (let k in obj) str += k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + ':' + obj[k] + ';';
  return str;
};

let update = (node, v, redraw) => {
  if (!v._cmp)
    // add '' to convert to str; if the nodeValue has changed, update
    return node.nodeValue === v + '' || (node.nodeValue = v);

  for (let i in v.props) {
    let newProp = v.props[i];
    if (i in node) {
      if (redraw && i[0] === 'o' && i[1] === 'n' && isFn(newProp)) {
        let res, fn = newProp;
        node[i] = ev =>
          (res = fn(ev)) instanceof Promise
            ? res.finally(_ => (redraw(), res = NIL))
            : (redraw(), res = NIL);
      } else {
        if (i === 'style' && isObj(newProp))
          newProp = styles(newProp);
        node[i] = newProp;
      }
    } else if (!isFn(newProp) && node.getAttribute(i) != newProp) {
      if (newProp == null || newProp === false) node.removeAttribute(i);
      else node.setAttribute(i, newProp);
    }
  }

  for (let i = 0, names = [...node.getAttributeNames(), ...Object.keys(node)]; i < names.length; i++)
    if (!(names[i] in v.props))
      (i in node)
        ? (node[names[i]] = NIL)
        : (node.removeAttribute(names[i]));
}

export function render(parent, cmp, redraw) {
  let i, tmp,
    olds = parent.childNodes || [],
    children = cmp.children || (isFn(cmp) ? cmp() : []),
    news = isArray(children) ? children : [children];

  for (i = 0, tmp = Array(Math.max(0, olds.length - news.length)); i < tmp.length; i++)
    parent.removeChild(parent.lastChild);

  for (i = 0; i < news.length; i++) {
    let node, vnode = news[i];
    node = olds[i] || createNode(vnode);

    if (!olds[i]) parent.appendChild(node);
    else if ((node.tagName || '') !== (vnode.tag || '').toUpperCase()) {
      node = createNode(vnode);
      parent.replaceChild(node, olds[i]);
    }

    update(node, vnode, redraw);
    render(node, vnode, redraw);
  }
}

export function mount(el, cmp) {
  let redraw;
  el.innerHTML = '';

  REDRAWS.push(
    redraw = _ => requestAnimationFrame(
      _ => render(el, { children: cmp() }, redraw)
    )
  );

  return redraw() && redraw;
}

export const redraw = _ =>
  REDRAWS.map(r => r());

export function m(tag, ...tail) {
  let k, tmp, classes,
    first = tail[0],
    props = {},
    children = [];

  if (isObj(first) && !isArray(first) && first.tag === NIL)
    [props, ...tail] = tail;

  if (isStr(tag)) {
    [tag, ...classes] = tag.split('.');
    classes = classes.join(' ');

    if (isObj(tmp = props.class)) {
      for (k in tmp) {
        if (tmp[k]) {
          if (classes) classes += ' ';
          classes += k;
        }
      }
    }

    if (isStr(tmp)) classes += !classes ? tmp : tmp ? ' ' + tmp : '';
    if (classes) props.class = classes;
  }

  addChildren(tail, children); // will recurse through tail and push valid childs to `children`
  return { _cmp: 1, tag, props: { ...props }, children };
}
