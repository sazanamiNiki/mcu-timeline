import test from 'node:test';
import assert from 'node:assert/strict';
import { splitByPrerequisites, prerequisiteWorks, rolledPrerequisites } from '../../assets/guide.js';

const WORKS = [
  { id: 'a', dateUs: '2008-05-02' },
  { id: 'd', dateUs: '2010-05-07' },
  { id: 'b', dateUs: '2012-04-25' },
  { id: 'c', dateUs: '2018-04-27' },
];
const EDGES = [
  { from: 'a', to: 'b', note: 'x' },
  { from: 'b', to: 'c', note: 'y' },
  { from: 'z', to: 'c', note: 'unincluded' },
];

test('splitByPrerequisites は前提の有無で分け、どちらも公開順に並べる', () => {
  const { standalone, dependent } = splitByPrerequisites(WORKS, EDGES);
  assert.deepEqual(standalone.map((w) => w.id), ['a', 'd']);
  assert.deepEqual(dependent.map((w) => w.id), ['b', 'c']);
});

test('prerequisiteWorks は先に観る作品を遡って公開順で返し、未収録の id は捨てる', () => {
  const works = prerequisiteWorks('c', WORKS, EDGES);
  assert.deepEqual(works.map((w) => w.id), ['a', 'b']);
});

test('rolledPrerequisites はクロスオーバー級の作品にその前提チェーンを丸め込む', () => {
  const works = [
    { id: 'a', dateUs: '2008-05-02' },
    { id: 'b', dateUs: '2009-06-01' },
    { id: 'c', dateUs: '2010-07-01' },
    { id: 'h', dateUs: '2011-05-04' },
    { id: 'x', dateUs: '2012-08-01' },
  ];
  const edges = [
    { from: 'a', to: 'h' }, { from: 'b', to: 'h' }, { from: 'c', to: 'h' },
    { from: 'h', to: 't' }, { from: 'a', to: 't' }, { from: 'x', to: 't' },
  ];
  assert.deepEqual(rolledPrerequisites('t', works, edges).map((w) => w.id), ['h', 'x']);
});

test('rolledPrerequisites は前提が少ない作品には丸め込まない', () => {
  const works = [
    { id: 'y', dateUs: '2008-05-02' },
    { id: 'z', dateUs: '2009-06-01' },
  ];
  const edges = [
    { from: 'y', to: 'z' }, { from: 'z', to: 't' }, { from: 'y', to: 't' },
  ];
  assert.deepEqual(rolledPrerequisites('t', works, edges).map((w) => w.id), ['y', 'z']);
});

test('rolledPrerequisites は集約点でない後発作品にクロスオーバーを丸め込まない', () => {
  // m はクロスオーバー h の後日譚（直接の前提は h の1本だけ）。h は残るべき。
  const works = [
    { id: 'a', dateUs: '2008-05-02' },
    { id: 'b', dateUs: '2009-06-01' },
    { id: 'c', dateUs: '2010-07-01' },
    { id: 'h', dateUs: '2011-05-04' },
    { id: 'm', dateUs: '2012-08-01' },
  ];
  const edges = [
    { from: 'a', to: 'h' }, { from: 'b', to: 'h' }, { from: 'c', to: 'h' },
    { from: 'h', to: 'm' },
    { from: 'h', to: 't' }, { from: 'm', to: 't' },
  ];
  assert.deepEqual(rolledPrerequisites('t', works, edges).map((w) => w.id), ['h', 'm']);
});
