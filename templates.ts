const _if = (condition: unknown, template: string) => (
  condition ? template : ''
);

const _forEach = (arr: unknown[], fn: (x: unknown) => string) => (
  arr.reduce((a: string, c: unknown) =>
    a += (fn(c) || ''),
    ''
  )
);

const Layout = (title: string, content: string) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="personal article archive" >
    <link rel="stylesheet" href="/main.css">
    <title>
      ${title || 'arkive'}
    </title>
  </head>
  <body>
    ${content}
  </body>
  </html>
`;

export const Home = () => Layout('arkive', `
  <main>
    <h1>arkive</h1>
    <a href="/add">add</a>
  </main>
`);

export const Add = () => Layout('add url', `
  <main>
    <h1>add url</h1>
    <form action="/add" method="post">
      <input type="text" name="url" placeholder="url" required>
      <input type="text" name="title" placeholder="title">
      <button type="submit">add</button>
    </form>
  </main>
`);