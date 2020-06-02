import './skeleton.css'
const m = require('mithril')

var root = document.body

m.render(root, [
  <div class="container">
    <h2>This is a test</h2>
    <p /> 
    <pre><code>{
`.some-class {
  background-clor: red;
}`
    }</code></pre>
  </div>
])
