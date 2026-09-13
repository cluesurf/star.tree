// The lean equivalence gate.
//
// Lean is a SURFACE: a file whose role carries `mark lean` reads a bare head as a call and a property head as
// a named argument, and nothing else changes. So the whole bug class the feature can have is the two spellings
// building different programs. Every fixture here is written twice, lean and long, milled with the flag on
// and off respectively, and compared after the checker has resolved the labels, which is where the two
// spellings are meant to converge. A difference is a failure. note/term/lean.md.
//
// Run: npx tsx test/compile/lean.ts

import { compile } from '@term/make/code/compile/compile'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean, info = ''): void {
  if (cond) {
    pass++
    console.log(`ok    ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}  ${info}`)
  }
}

// the definitions every fixture shares: a form, a task with a list parameter, a default and a flag
const PRELUDE = `
form point
  link a, like number
  link b, like number

form bundle
  link key, like text
  link states, like list, like text

task dimension
  take key, like text
  take states, like list, like text
  take max-count, like number, fall 1
  take strict, like boolean, fall false
  like text
  send back, read key
`

// the emitted TypeScript, or the diagnostics as one string when it did not build
function emit(body: string, lean: boolean): string {
  const out = compile(
    { file: '/gate/code/lean.tree', text: PRELUDE + body },
    { leanOf: () => lean },
  )

  return out.ok
    ? out.typescript
    : `DIAGNOSTICS: ${out.diagnostics.map(d => d.message).join(' | ')}`
}

type Pair = { name: string; lean: string; long: string }

const PAIRS: Pair[] = [
  {
    name: 'a call with property heads, stacked',
    lean: `
task go
  like text
  save r
    dimension
      key <tense>
      states <present>, <imperfect>
      max-count 1
  send back, read r
`,
    long: `
task go
  like text
  save r
    call dimension
      bind key, text <tense>
      bind states
        make list
          text <present>
          text <imperfect>
      bind max-count, code 1
  send back, read r
`,
  },
  {
    name: 'a call with single-valued properties on one line and the list stacked',
    lean: `
task go
  like text
  save r
    dimension key <tense>, max-count 1
      states <present>, <imperfect>
  send back, read r
`,
    long: `
task go
  like text
  save r
    call dimension
      bind key, text <tense>
      bind max-count, code 1
      bind states
        make list
          text <present>
          text <imperfect>
  send back, read r
`,
  },
  {
    name: 'a bare word names a boolean parameter, so it is that flag set to true',
    lean: `
task go
  like text
  save r
    dimension key <tense>, strict
      states <present>
  send back, read r
`,
    long: `
task go
  like text
  save r
    call dimension
      bind key, text <tense>
      bind strict, true
      bind states
        make list
          text <present>
  send back, read r
`,
  },
  {
    name: 'an explicit bind inside a lean call is the long-form escape and keeps its name',
    lean: `
task go
  like text
  save r
    dimension
      bind key, text <tense>
      states <present>
  send back, read r
`,
    long: `
task go
  like text
  save r
    call dimension
      bind key, text <tense>
      bind states
        make list
          text <present>
  send back, read r
`,
  },
  {
    name: 'make with property heads fills the fields',
    lean: `
task shape
  like point
  save p, make point, a 10, b 20
  send back, read p
`,
    long: `
task shape
  like point
  save p
    make point
      bind a, code 10
      bind b, code 20
  send back, read p
`,
  },
  {
    name: 'a bare head that names a form is a construction of that form',
    lean: `
task shape
  like point
  save p
    point
      a 10
      b 20
  send back, read p
`,
    long: `
task shape
  like point
  save p
    make point
      bind a, code 10
      bind b, code 20
  send back, read p
`,
  },
  {
    name: 'a property whose value is a read heads its own line',
    lean: `
task shape
  like point
  save p, make point, a 10, b 20
  save q
    point
      a, read p/b
      b, read p/a
  send back, read q
`,
    long: `
task shape
  like point
  save p
    make point
      bind a, code 10
      bind b, code 20
  save q
    make point
      bind a, read p/b
      bind b, read p/a
  send back, read q
`,
  },
  {
    // a bare head naming a CASE of a sum builds that case, tagged with its `form`, nested under a property
    name: 'a bare head that names a variant is a construction of that case',
    lean: `
form pattern
  case feature
    link feature, like text
    link value, like text
  case reference
    link element, like text

form construct
  link key, like text
  link pattern, like pattern

task shape
  like construct
  send back
    construct key <noun>
      pattern
        feature feature <part_of_speech>, value <noun>
`,
    long: `
form pattern
  case feature
    link feature, like text
    link value, like text
  case reference
    link element, like text

form construct
  link key, like text
  link pattern, like pattern

task shape
  like construct
  send back
    make construct
      bind key, text <noun>
      bind pattern
        make feature
          bind feature, text <part_of_speech>
          bind value, text <noun>
`,
  },
  {
    // the stdlib's own idiom: an explicit `bind` on a receiver-dispatched method is documentation, and lean
    // must leave it exactly as the long form has it, because the labels did not come from property heads
    name: 'an explicit bind on a receiver method is untouched under lean',
    lean: `
form box
  link items, like list

  task push
    take self
    take item, like number
    like number
    send back
      call self/items/push
        read item

task count
  like number
  save b
    make box
      bind items
        make list
  call push
    bind self, read b
    bind item, code 1
  send back, read b/items/length
`,
    long: `
form box
  link items, like list

  task push
    take self
    take item, like number
    like number
    send back
      call self/items/push
        read item

task count
  like number
  save b
    make box
      bind items
        make list
  call push
    bind self, read b
    bind item, code 1
  send back, read b/items/length
`,
  },
  {
    // an anonymous task in value position keeps its `take`: `mine task` used to read the first `take` line as
    // the task's NAME and drop the parameter (lean-0014). The same under both spellings, so the pair is equal
    // and, more to the point, neither is a diagnostic
    name: 'an anonymous task keeps its parameter',
    lean: `
task first
  take xs, like list, like number
  like number
  save found
    call xs/find
      task
        take one, like number
        like boolean
        back is-above one, 1
  back found
`,
    long: `
task first
  take xs, like list, like number
  like number
  save found
    call xs/find
      task
        take one, like number
        like boolean
        send back
          call is-above
            read one
            code 1
  send back, read found
`,
  },
  {
    name: 'a builtin written as a bare head folds to its operator',
    lean: `
task both
  take a, like boolean
  take b, like boolean
  like boolean
  back and a, b
`,
    long: `
task both
  take a, like boolean
  take b, like boolean
  like boolean
  send back
    call and
      read a
      read b
`,
  },
  {
    // a LIST field repeats its head, one entry per line, which is how a DSL wants to write one. The rule is
    // the declared type, exactly as for a single head: a list accumulates, and a scalar given twice is refused.
    name: 'a list field accumulates across repeated property heads',
    lean: `
task go
  like bundle
  send back
    bundle
      key <tense>
      states <present>
      states <imperfect>
      states <aorist>
`,
    long: `
task go
  like bundle
  send back
    make bundle
      bind key
        text <tense>
      bind states
        make list
          text <present>
          text <imperfect>
          text <aorist>
`,
  },
]

for (const pair of PAIRS) {
  const lean = emit(pair.lean, true)
  const long = emit(pair.long, false)

  ok(
    pair.name,
    lean === long && !lean.startsWith('DIAGNOSTICS'),
    lean === long ? lean : `\n--- lean ---\n${lean}\n--- long ---\n${long}`,
  )
}

// and the things lean must REFUSE, each with the reason a reader gets
const REFUSALS: { name: string; text: string; expect: string }[] = [
  {
    name: 'a label the callee does not have',
    text: `
task go
  like text
  send back
    dimension key <tense>, kee <x>
      states <present>
`,
    expect: 'has no parameter "kee"',
  },
  {
    name: 'two values into a scalar parameter',
    text: `
task go
  like text
  send back
    dimension
      key <tense>, <mood>
      states <present>
`,
    expect: 'takes one value, and this gives 2',
  },
  {
    name: 'a multi-valued property written inline after another property is split by the comma',
    text: `
task go
  like text
  send back
    dimension key <tense>, states <present>, <imperfect>, max-count 1
`,
    expect: 'given twice',
  },
  {
    name: 'a bare word that is neither in scope nor a boolean parameter',
    text: `
task go
  like text
  send back
    dimension key <tense>, loose
      states <present>
`,
    expect: 'is not defined',
  },
  {
    name: 'a stray positional in a form construction',
    text: `
task shape
  like point
  save p, make point, a 10, b 20
  send back
    point a, read p/b
`,
    expect: 'needs a field name as its head',
  },
  // THE COMMA TRAP, both shapes it was met in during the Sanskrit port. The comma pops one level, so the
  // inline call after it stays open and the statement head is left holding an extra argument. It used to be
  // reported as `the name "back" is not defined`, pointing at a whole line with nothing wrong on it, and it
  // cost an hour each time.
  {
    name: 'a statement head left holding an extra argument by a comma (send back)',
    text: `
task shape
  like number
  back dimension key <tense>, 0, 1
`,
    expect: '`back` is a statement',
  },
  {
    name: 'a statement head left holding an extra argument by a comma (fork)',
    text: `
task shape
  take n, like number
  like number
  fork test, is-above add(n, n), 1
    hook hold
      send back, read n
  send back, read n
`,
    expect: '`fork` is a statement',
  },
  // a field the form does not declare. The comma pops ONE level, so an inline construction is still open when
  // the next property arrives and swallows it: `position some value 3, description <x>` shipped
  // `{ form: "some", value: 3, description: ["x"] }` on a clean build, with the enclosing field left empty.
  {
    name: 'a property that landed inside an inline construction the comma left open',
    text: `
task shape
  like point
  send back
    point a 10, b 20, c 30
`,
    expect: 'has no field "c"',
  },
  // a scalar field given twice. It used to emit `{ a: 10, b: 20, a: 30 }`: the second silently replaced the
  // first, which built two wrong tables in the Sanskrit port and was caught only by a parity test.
  {
    name: 'a scalar property head given twice on a construction',
    text: `
task shape
  like point
  send back
    point
      a 10
      b 20
      a 30
`,
    expect: 'is given twice',
  },
  // a statement inside an arm of a VALUE-position fork. The whole fork used to vanish and the backend emitted
  // `undefined` as the value, so every augmented athematic form came out `undefinedasmi` on a clean build.
  {
    name: 'a statement inside an arm of a value-position fork',
    text: `
task pick
  take n, like number
  like text
  save word
    fork test
      hook test
        is-above n, code 1
      hook hold
        save big, text <big>
        read big
      hook miss
        text <small>
  send back, read word
`,
    expect: 'one value per arm',
  },
  // a loop-only statement outside a loop. This compiled and then failed in the EMITTED TypeScript with
  // `Cannot use "continue" here`, which is a diagnostic in the wrong language pointing at generated code.
  {
    name: 'turn next outside a loop',
    text: `
task shape
  take n, like number
  like number
  fork test, is-above n, code 1
    hook hold
      turn next
  send back, read n
`,
    expect: '`turn next` is only valid inside a loop',
  },
]

for (const refusal of REFUSALS) {
  const out = emit(refusal.text, true)

  ok(
    `refuses: ${refusal.name}`,
    out.startsWith('DIAGNOSTICS') && out.includes(refusal.expect),
    out,
  )
}

// and the long form under the lean flag is unchanged: a file may be written entirely long and mean the same
{
  const body = PAIRS[0]!.long

  ok('the long form means the same with the flag on', emit(body, true) === emit(body, false))
}

// ---- the host role: a data file ----

// a data file compiles to its value as JSON. Under the mark, a head the dialect does not know, carrying a
// value, is a `host` entry keyed by that head; `list` stays `list`.
function emitData(text: string, lean: boolean): string {
  const out = compile(
    { file: '/gate/data/lean.tree', text },
    { roleOf: () => 'host', leanOf: () => lean },
  )

  return out.ok
    ? out.typescript
    : `DIAGNOSTICS: ${out.diagnostics.map(d => d.message).join(' | ')}`
}

const DATA_PAIRS: Pair[] = [
  {
    name: 'host: scalars by their own head',
    lean: `key <tense>\nmax-count 1\nstrict true\n`,
    long: `host key, <tense>\nhost max-count, 1\nhost strict, true\n`,
  },
  {
    name: 'host: a map by its own head, with entries by theirs',
    lean: `point\n  a 10\n  b 20\n`,
    long: `host point\n  host a, 10\n  host b, 20\n`,
  },
  {
    name: 'host: a list still says list, and lean entries sit beside it',
    lean: `name <tense>\nlist states\n  <present>, <imperfect>\n`,
    long: `host name, <tense>\nlist states\n  <present>, <imperfect>\n`,
  },
  {
    name: 'host: the long form is unchanged under the mark',
    lean: `host key, <tense>\nlist states\n  <a>, <b>\n`,
    long: `host key, <tense>\nlist states\n  <a>, <b>\n`,
  },
]

for (const pair of DATA_PAIRS) {
  const lean = emitData(pair.lean, true)
  const long = emitData(pair.long, false)

  ok(
    pair.name,
    lean === long && !lean.startsWith('DIAGNOSTICS'),
    lean === long ? lean : `\n--- lean ---\n${lean}\n--- long ---\n${long}`,
  )
}

// two values under a bare head is not a list: the reader says to write `list`, as it does for `host`
{
  const out = emitData(`states <a>, <b>\n`, true)

  ok(
    'host refuses: two values under a bare head, and says to write list',
    out.startsWith('DIAGNOSTICS') && out.includes('A list is written "list states"'),
    out,
  )
}

// and without the mark, a bare head is not data at all
{
  const out = emitData(`key <tense>\n`, false)

  ok(
    'host refuses: a bare head without the mark is not data',
    out.startsWith('DIAGNOSTICS') && out.includes('is not data'),
    out,
  )
}

// ---- the view role: a document ----

// a document compiles through the view reader and lowering. Under the mark, a plain-name child of a placement
// with a value is a `bind` whose term is its head. The `view` head itself stays (lean-0029).
function emitView(text: string, lean: boolean): string {
  const out = compile(
    { file: '/gate/view/lean.tree', text },
    { roleOf: () => 'view', leanOf: () => lean },
  )

  return out.ok
    ? out.typescript
    : `DIAGNOSTICS: ${out.diagnostics.map(d => d.message).join(' | ')}`
}

const VIEW_PAIRS: Pair[] = [
  {
    name: 'view: a placement takes its inputs by their own heads',
    lean: `view page\n  view text/term\n    label <alpha>\n    size 2\n`,
    long: `view page\n  view text/term\n    bind label, <alpha>\n    bind size, 2\n`,
  },
  {
    name: 'view: an input under a nested placement',
    lean: `view page\n  view data/row\n    view text/term\n      label <alpha>\n`,
    long: `view page\n  view data/row\n    view text/term\n      bind label, <alpha>\n`,
  },
  {
    name: 'view: the long form is unchanged under the mark',
    lean: `view page\n  view text/term\n    bind label, <alpha>\n`,
    long: `view page\n  view text/term\n    bind label, <alpha>\n`,
  },
  {
    // `text` is a BODY head in the view dialect (a text node), so an input called `text` keeps its `bind`:
    // the lean spelling of that line is a text child, on purpose, and the same under the mark or not
    name: 'view: `text` is a body head, so a bare `text <x>` is a text node under the mark too',
    lean: `view page\n  view text/term\n    text <alpha>\n`,
    long: `view page\n  view text/term\n    text <alpha>\n`,
  },
]

for (const pair of VIEW_PAIRS) {
  const lean = emitView(pair.lean, true)
  const long = emitView(pair.long, false)

  ok(
    pair.name,
    lean === long && !lean.startsWith('DIAGNOSTICS'),
    lean === long ? lean : `\n--- lean ---\n${lean}\n--- long ---\n${long}`,
  )
}

// a component input takes one value
{
  const out = emitView(`view page\n  view text/term\n    label <a>, <b>\n`, true)

  ok(
    'view refuses: two values into one input',
    out.startsWith('DIAGNOSTICS') && out.includes('takes one'),
    out,
  )
}

console.log(`\nlean: ${pass} pass, ${fail} fail`)

if (fail > 0) {
  process.exitCode = 1
}
