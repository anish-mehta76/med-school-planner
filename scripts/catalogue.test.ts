import { describe, expect, it } from 'vitest';
import { parseProgram, programLinks, selectCount } from './catalogue.ts';

const code = (c: string) => `<a href="/search/?P=${c}" class="bubblelink code">${c}</a>`;
const row = (cls: string, codes: string, title: string, cr = '') => `<tr class="${cls}"><td class="codecol">${codes}</td><td>${title}</td><td class="hourscol">${cr}</td></tr>`;
const comment = (cls: string, text: string) => `<tr class="${cls}"><td colspan="2"><span class="courselistcomment ${cls}">${text}</span></td><td class="hourscol"></td></tr>`;
const indented = (c: string, title: string) => row('', `<div style="margin-left:20px;" class="blockindent">${code(c)}</div>`, title);

const page = `<h1 class="page-title">Example, Bachelor of Arts</h1>
<div id="requirementstextcontainer"><table class="sc_courselist"><tbody>
${comment('areaheader', 'Core')}
${row('', `${code('AS.030.101')}<span class="blockindent">&amp; ${code('AS.030.105')}</span>`, 'Intro Chem I<sup>1</sup>', '4')}
${row('orclass', `or ${code('AS.030.103')}`, 'or Applied Chem')}
${comment('', 'Select two of the following:')}
${indented('AS.020.151', 'Bio I')}
${indented('AS.020.152', 'Bio II')}
${indented('AS.020.303', 'Genetics')}
${row('', code('AS.280.101'), 'Intro PH', '4')}
${comment('', 'Select one course from Table 1.')}
${comment('', 'Nine credits of approved electives 9')}
<tr class="listsum"><td colspan="2">Total Credits</td><td class="hourscol">40</td></tr>
</tbody></table>
<table class="sc_courselist"><tbody>${row('', code('AS.200.101'), 'Intro Psych', '3')}${row('', code('AS.230.101'), 'Intro Soc', '3')}</tbody></table>
</div><div id="sampleprogramtextcontainer"></div>`;

describe('catalogue import', () => {
  it('reads select counts in words or digits', () => {
    expect(selectCount('Select two Biology Lecture Courses of the following:')).toBe(2);
    expect(selectCount('Complete one from the following')).toBe(1);
    expect(selectCount('Choose 3 electives')).toBe(3);
    expect(selectCount('Nine credits of electives')).toBeNull();
  });

  it('turns course rows, or-rows, select groups, table references and text into requirements', () => {
    const p = parseProgram(page, '/arts-sciences/x/example-bachelor-arts/', 'KSAS')!;
    const r = p.major.requirements;
    expect(p.major).toMatchObject({ id: 'ksas-example-bachelor-arts', name: 'Example, Bachelor of Arts', degree: 'BA', totalLabel: '40 credits' });
    expect(r[0]).toMatchObject({ type: 'set', section: 'Core', options: [['AS.030.101', 'AS.030.105'], ['AS.030.103']] });
    expect(r[1]).toMatchObject({ type: 'pick', n: 2, from: ['AS.020.151', 'AS.020.152', 'AS.020.303'] });
    expect(r[2]).toMatchObject({ type: 'set', options: [['AS.280.101']] });
    expect(r[3]).toMatchObject({ type: 'pick', n: 1, from: ['AS.200.101', 'AS.230.101'] });
    expect(r[4]).toMatchObject({ type: 'note', label: 'Nine credits of approved electives' });
    expect(p.courses['AS.030.101']).toEqual(['Intro Chem I', null]);
    expect(p.courses['AS.230.101']).toEqual(['Intro Soc', 3]);
  });

  it('finds bachelor programs only', () => {
    const html = '<a href="/arts-sciences/d/chem/chemistry-bachelor-science/">x</a><a href="/arts-sciences/d/chem/chemistry-bachelors-masters-combined/">y</a>';
    expect(programLinks(html, '/arts-sciences/d/')).toEqual(['/arts-sciences/d/chem/chemistry-bachelor-science/']);
  });
});
