import { expect } from '@open-wc/testing';
import { parseNDJSON, parseSSE, readLines } from '../src/services/streams.js';
import { collect, streamOf } from './helpers/mock-fetch.js';

describe('streams', () => {
  it('readLines splits chunks on \\n and \\r\\n, including the last line', async () => {
    const lines = await collect(readLines(streamOf(['a\r\nb', 'c\n', '\nd'])));
    expect(lines).to.deep.equal(['a', 'bc', '', 'd']);
  });

  it('parseSSE yields events split across chunks', async () => {
    const events = await collect(
      parseSSE(
        streamOf([
          ': comment\n',
          'data: {"a":1}\n\nevent: ping\nda',
          'ta: x\n\n',
          'data: line1\ndata: line2\n\n',
          'data: tail',
        ]),
      ),
    );
    expect(events).to.deep.equal([
      { event: 'message', data: '{"a":1}' },
      { event: 'ping', data: 'x' },
      { event: 'message', data: 'line1\nline2' },
      { event: 'message', data: 'tail' },
    ]);
  });

  it('parseNDJSON yields one object per non-empty line', async () => {
    const items = await collect(
      parseNDJSON(streamOf(['{"n":1}\n\n{"n"', ':2}\n'])),
    );
    expect(items).to.deep.equal([{ n: 1 }, { n: 2 }]);
  });
});
