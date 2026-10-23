import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const dir = mkdtempSync(join(tmpdir(), 'sb-branding-'));
try {
  for (const name of ['csv-import', 'blog-assignment', 'stats', 'sheet-period']) {
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    writeFileSync(join(dir, `${name}.cjs`), ts.transpileModule(source.replaceAll("'./blog-assignment'", "'./blog-assignment.cjs'").replaceAll("'./csv-import'", "'./csv-import.cjs'"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText);
  }
  const require = createRequire(import.meta.url);
  const { buildCsvExportUrl, detectSheetPeriod } = require(join(dir, 'sheet-period.cjs'));
  const { parseCSVRows, importCsvForMonth } = require(join(dir, 'csv-import.cjs'));
  const { workRolesFor, summarizeWork, isBranding, assignmentWriterFilter, assignmentWorkLabels, blogQuantityFor, assignmentPartnersFor } = require(join(dir, 'blog-assignment.cjs'));
  const { calcWriterStats, totalQty } = require(join(dir, 'stats.cjs'));
  const header = ['갱신월','갱신일','과목/병원명','지점명','N 정보성','수량','N 임상/논문','수량','비고','블로그 총 수량','SEO 컨텐츠','비고','수량','최적배포','수량','인블','구분','연결','진행여부','패키지'];
  const row = ['11월','1일','피부과, 유앤아이','테스트','A',6,'B',2,'메모',8,'B','SEO 메모',8,'C',10,8,'직','','','브랜딩'];
  const csv = rows => rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const tabUrl = 'https://docs.google.com/spreadsheets/d/test-sheet/edit?gid=123#gid=123';
  assert.equal(buildCsvExportUrl(tabUrl), 'https://docs.google.com/spreadsheets/d/test-sheet/export?format=csv&gid=123');
  assert.equal(buildCsvExportUrl(tabUrl.replace('?gid=123','')), buildCsvExportUrl(tabUrl));
  assert.equal(buildCsvExportUrl(tabUrl.replaceAll('123','0')).endsWith('gid=0'),true);
  for (const bad of ['https://docs.google.com/spreadsheets/d/test/edit', tabUrl.replace('#gid=123','#gid=124'), tabUrl.replace('docs.google.com','evil.example'), tabUrl.replaceAll('123','abc')]) {
    assert.throws(()=>buildCsvExportUrl(bad));
  }
  const october = [...row]; october[0]='10월';
  const filename = name => `attachment; filename="fallback.csv"; filename*=UTF-8''${encodeURIComponent('업무 배정 - '+name+'.csv')}`;
  assert.deepEqual(detectSheetPeriod(csv([header,october]),filename('2027.10')),
    {month:'2027-10',monthLabel:'2027년 10월',sheetName:'2027.10'});
  assert.equal(detectSheetPeriod(csv([header,october]), 'attachment; filename="book-2026.10.csv"').month,'2026-10');
  assert.equal(detectSheetPeriod(csv([header,row]),filename('2026.11')).month,'2026-11');
  const explicitYear=[...october]; explicitYear[0]='2027-10';
  assert.equal(detectSheetPeriod(csv([header,explicitYear]),filename('2027.10')).month,'2027-10');
  assert.throws(()=>detectSheetPeriod(csv([header,explicitYear]),filename('2026.10')),/일치하지/);
  assert.throws(()=>detectSheetPeriod(csv([header,row,october]),filename('2026.11')),/일치하지/);
  for (const name of ['10월','2027.00','2027.13','2027.10 수정']) {
    assert.throws(()=>detectSheetPeriod(csv([header,october]),filename(name)),/탭 이름/);
  }
  assert.throws(()=>detectSheetPeriod(csv([header,october]),null),/탭 이름/);
  assert.throws(()=>detectSheetPeriod(csv([header,october]),"attachment; filename*=UTF-8''%broken"),/탭 이름/);
  assert.throws(()=>detectSheetPeriod(csv([header]),filename('2027.10')),/데이터가 없습니다/);
  const parsed = parseCSVRows(csv([header, row]))[0];
  assert.equal(parsed.mainWriter, 'A'); assert.equal(parsed.clinicalWriter, 'B');
  assert.equal(parsed.informationQuantity, 6); assert.equal(parsed.clinicalQuantity, 2);
  assert.equal(parsed.mainQuantity, 8); assert.equal(parsed.subWriter, 'B'); assert.equal(parsed.subQuantity, 8);
  assert.equal(parsed.optimalQuantity, 10); assert.equal(parsed.inblQuantity, 8);
  const split = { month:'2026-11', package_name:'브랜딩', main_writer_id:'A', main_writer_name:'A', main_quantity:8,
    clinical_writer_id:'B', clinical_writer_name:'B', information_quantity:6, clinical_quantity:2,
    sub_writer_id:'B', sub_writer_name:'B', sub_quantity:8 };
  assert.deepEqual(workRolesFor(split, 'A'), [{label:'정보형', qty:6}]);
  assert.deepEqual(workRolesFor(split, 'B'), [{label:'임상/논문형', qty:2},{label:'SEO 콘텐츠', qty:8}]);
  assert.equal(summarizeWork([split], 'A').total, 6);
  assert.equal(summarizeWork([split], 'B').total, 10);
  assert.equal(summarizeWork([split], 'unrelated').total, 0);
  const stats = calcWriterStats([split]);
  assert.equal(totalQty(stats.A), 6); assert.equal(totalQty(stats.B), 10);
  const same = { ...split, main_writer_id:'B', main_writer_name:'B', information_quantity:null, clinical_quantity:null };
  assert.deepEqual(workRolesFor(same, 'B'), [{label:'네이버 블로그',qty:8},{label:'SEO 콘텐츠',qty:8}]);
  assert.equal(summarizeWork([same], 'B').total, 16);
  assert.equal(totalQty(calcWriterStats([same]).B), 16);
  const sameSplit = { ...split, main_writer_id:'B', main_writer_name:'B' };
  assert.equal(totalQty(calcWriterStats([sameSplit]).B), 16);
  assert.equal(calcWriterStats([sameSplit]).B.branchCount, 1);
  const old = { ...split, month:'2026-10' };
  assert.equal(isBranding(old), false);
  assert.deepEqual(workRolesFor(old, 'A'), [{label:'작성',qty:8},{label:'검토',qty:8}]);
  assert.equal(summarizeWork([old], 'A').blogTotal, 8);
  assert.equal(summarizeWork([split], 'A').blogTotal, 6);
  assert.equal(isBranding({...split,package_name:null}), false);
  assert.equal(assignmentWriterFilter('B').includes('clinical_writer_id.eq.B'), true);
  const empty = [...row]; empty[5]=''; empty[7]=''; empty[6]='A';
  assert.equal(parseCSVRows(csv([header,empty]))[0].informationQuantity, null);
  const invalid = [...empty]; invalid[6]='B';
  assert.throws(() => parseCSVRows(csv([header,invalid])), /두 담당자가 같아야/);
  for (const quantity of [3, -1, 'abc', 1.5]) {
    const bad = [...row]; bad[7]=quantity;
    assert.throws(() => parseCSVRows(csv([header,bad])));
  }
  const missing = [...row]; missing[7]='';
  assert.throws(() => parseCSVRows(csv([header,missing])), /일치해야/);
  const zero = [...row]; zero[5]=8; zero[7]=0;
  assert.equal(parseCSVRows(csv([header,zero]))[0].clinicalQuantity, 0);
  const legacyHeaders = ['갱신월','갱신일','과목/병원명','지점명','사수','비고','수량','부사수','비고','수량','최적배포','수량','인블','구분','연결','진행여부','패키지'];
  const legacyRow = ['10월','1일','피부과','테스트','A','비고',8,'B','',8,'C',10,8,'직','','','브랜딩'];
  const legacy = parseCSVRows(csv([legacyHeaders,legacyRow]))[0];
  assert.equal(legacy.format,'v2'); assert.equal(legacy.mainQuantity,8); assert.equal(legacy.subQuantity,8);
  const v1Headers = legacyHeaders.slice(0,12).concat(['최적배포 비고','인블','진행여부']);
  const v1 = parseCSVRows(csv([v1Headers,legacyRow.slice(0,12).concat(['최적 메모',8,'중단'])]))[0];
  assert.equal(v1.format,'v1'); assert.equal(v1.optimalNote,'최적 메모'); assert.equal(v1.inblQuantity,8); assert.equal(v1.progressStatus,'중단');
  let writes = 0;
  const noWrites = { from() { writes++; throw new Error('unexpected DB call'); } };
  await assert.rejects(importCsvForMonth(noWrites,csv([header,row]),'2026-10'), /11월부터/);
  await assert.rejects(importCsvForMonth(noWrites,csv([header,invalid]),'2026-11'), /두 담당자/);
  assert.equal(writes,0);
  const noSchema = { from() { return { select() { return { limit() { return {error:{message:'missing column'}}; } }; } }; } };
  await assert.rejects(importCsvForMonth(noSchema,csv([header,row]),'2026-11'), /마이그레이션/);
  let imported;
  const fakeDb = {
    from(table) {
      const filters = {};
      const builder = {
        select() { return builder; }, eq(key,value) { filters[key]=value; return builder; },
        update() { return builder; }, insert() { return builder; },
        limit() { return Promise.resolve({error:null}); },
        maybeSingle() { return Promise.resolve({data:{id:table === 'profiles' ? filters.name : 'same-branch'}}); },
        then(resolve) { resolve({error:null}); },
      };
      return builder;
    },
    rpc(name, args) { assert.equal(name,'replace_month_assignments'); imported=args; return Promise.resolve({error:null}); },
  };
  const second = [...row]; second[3]='테스트 (2)'; second[6]='C';
  await importCsvForMonth(fakeDb,csv([header,row,second]),'2026-11');
  assert.equal(imported.new_assignments.length,2);
  assert.deepEqual(imported.new_assignments.map(a=>a.slot),[1,2]);
  assert.deepEqual(imported.new_assignments.map(a=>a.clinical_writer_id),['B','C']);
  assert.equal(imported.new_assignments[0].main_quantity,8);
  assert.equal(imported.new_assignments[0].information_quantity,6);
  await importCsvForMonth(fakeDb,csv([header,october]),'2027-10');
  assert.equal(imported.target_month,'2027-10');
  assert.equal(imported.new_assignments[0].month,'2027-10');
  for (const month of ['2026-11','2026-12','2027-01']) {
    for (const package_name of [null,undefined,'','일반','신규']) {
      const a = { month, package_name, main_writer_id:'A',main_writer_name:'A',main_quantity:4,
        sub_writer_id:'B',sub_writer_name:'B',sub_quantity:8 };
      assert.deepEqual(assignmentWorkLabels(a),['블로그(임상/논문)','블로그(정보성)']);
      assert.deepEqual(workRolesFor(a,'A'),[{label:'블로그(임상/논문)',qty:4}]);
      assert.deepEqual(workRolesFor(a,'B'),[{label:'블로그(정보성)',qty:8}]);
      assert.equal(summarizeWork([a],'A').review,0);
      assert.equal(summarizeWork([a],'B').blogTotal,8);
      assert.equal(blogQuantityFor(a,'B'),8);
      const combined = {...a,sub_writer_id:'A',sub_writer_name:'A'};
      assert.equal(summarizeWork([combined],'A').total,12);
      assert.equal(summarizeWork([combined],'A').blogTotal,12);
      const stats = calcWriterStats([combined]).A;
      assert.equal(stats.workQty['블로그(임상/논문)'],4);
      assert.equal(stats.workQty['블로그(정보성)'],8);
      assert.equal(totalQty(stats),12);
      const october = {...a,month:'2026-10'};
      assert.deepEqual(assignmentWorkLabels(october),['사수','부사수']);
      assert.deepEqual(workRolesFor(october,'A'),[{label:'작성',qty:4},{label:'검토',qty:8}]);
    }
  }
  assert.deepEqual(assignmentWorkLabels({month:'2026-11',package_name:' 브랜딩 '}),['네이버 블로그','SEO 콘텐츠']);
  assert.deepEqual(assignmentWorkLabels({month:'2026-10',package_name:'브랜딩'}),['사수','부사수']);
  const brandingStats = calcWriterStats([same]).B;
  assert.equal(brandingStats.workQty['네이버 블로그'],8);
  assert.equal(brandingStats.workQty['SEO 콘텐츠'],8);
  assert.equal(totalQty(brandingStats),16);
  console.log('PASS: November package labels, blank/non-branding packages, separate/shared writers, dashboard categories and October review compatibility');
  const sharedBranch = {month:'2026-11',package_name:null,main_writer_id:'oh',main_writer_name:'오희진',main_quantity:2,
    sub_writer_id:'cho',sub_writer_name:'조하영',sub_quantity:6,optimal_writer_id:'other',optimal_writer_name:'최적 담당',optimal_quantity:8};
  assert.deepEqual(assignmentPartnersFor(sharedBranch,'cho'),[{name:'오희진',role:'블로그(임상/논문)',qty:2}]);
  assert.deepEqual(assignmentPartnersFor(sharedBranch,'oh'),[{name:'조하영',role:'블로그(정보성)',qty:6}]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,main_writer_name:'이선주',main_writer_id:'lee'},'cho'),[{name:'이선주',role:'블로그(임상/논문)',qty:2}]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,package_name:'브랜딩'},'cho'),[{name:'오희진',role:'네이버 블로그',qty:2}]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,package_name:'브랜딩'},'oh'),[{name:'조하영',role:'SEO 콘텐츠',qty:6}]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,main_writer_id:'cho',main_writer_name:'조하영'},'cho'),[]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,main_quantity:0},'cho'),[]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,main_writer_id:null,main_writer_name:null},'cho'),[]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,main_writer_id:null},'cho'),[{name:'오희진',role:'블로그(임상/논문)',qty:2}]);
  assert.deepEqual(assignmentPartnersFor(sharedBranch,'other'),[]);
  assert.deepEqual(assignmentPartnersFor(sharedBranch,''),[]);
  assert.deepEqual(assignmentPartnersFor({...sharedBranch,month:'2026-10'},'cho'),[{name:'오희진',role:'사수',qty:2}]);
  assert.deepEqual(assignmentPartnersFor(split,'B'),[{name:'A',role:'네이버 블로그',qty:6}]);
  assert.equal(summarizeWork([sharedBranch],'cho').total,6);
  console.log('PASS: paired authors, branding roles, self exclusion, unassigned/zero quantities, legacy months and partner quantities independent of own totals');
  const unifiedHeaders = ['갱신월','갱신일','과목/병원명','지점명','네이버 블로그','비고','블로그 총 수량',
    'SEO 컨텐츠','비고','수량','최적배포','수량','인블','구분','연결','진행여부','패키지'];
  const unifiedRow = ['11월','1일','피부과','테스트','A','블로그 메모',8,'B','SEO 메모',5,'C',10,8,'직','','','브랜딩'];
  const unified = parseCSVRows(csv([unifiedHeaders,unifiedRow]))[0];
  assert.equal(unified.format,'v4');
  assert.equal(unified.mainWriter,'A'); assert.equal(unified.mainQuantity,8); assert.equal(unified.mainNote,'블로그 메모');
  assert.equal(unified.subWriter,'B'); assert.equal(unified.subQuantity,5); assert.equal(unified.subNote,'SEO 메모');
  assert.equal(unified.packageName,'브랜딩'); assert.equal(unified.clinicalWriter,'');
  const seoAlias = [...unifiedHeaders]; seoAlias[7]='SEO 콘텐츠';
  assert.equal(parseCSVRows(csv([seoAlias,unifiedRow]))[0].subQuantity,5);
  const shifted = [...unifiedHeaders]; [shifted[5],shifted[6]]=[shifted[6],shifted[5]];
  assert.throws(()=>parseCSVRows(csv([shifted,unifiedRow])),/F열/);
  assert.throws(()=>parseCSVRows(csv([unifiedHeaders.slice(0,16),unifiedRow])),/Q열/);
  for (const col of [6,9,11,12]) {
    for (const bad of ['abc',-1,1.5]) {
      const invalidRow = [...unifiedRow]; invalidRow[col]=bad;
      await assert.rejects(importCsvForMonth(noWrites,csv([unifiedHeaders,invalidRow]),'2026-11'),/0 이상의 정수/);
    }
  }
  const oldMonth = [...unifiedRow]; oldMonth[0]='10월';
  await assert.rejects(importCsvForMonth(noWrites,csv([unifiedHeaders,oldMonth]),'2026-10'),/11월부터/);
  await assert.rejects(importCsvForMonth(noWrites,csv([unifiedHeaders,unifiedRow]),'2026-12'),/일치하지/);
  await assert.rejects(importCsvForMonth(noSchema,csv([unifiedHeaders,unifiedRow]),'2026-11'),/마이그레이션/);
  assert.equal(writes,0);
  await importCsvForMonth(fakeDb,csv([unifiedHeaders,unifiedRow]),'2026-11');
  const saved = imported.new_assignments[0];
  assert.equal(saved.package_name,'브랜딩');
  for (const field of ['information_quantity','clinical_quantity','clinical_writer_id','clinical_writer_name']) assert.equal(saved[field],null);
  assert.deepEqual(workRolesFor(saved,'A'),[{label:'네이버 블로그',qty:8}]);
  assert.deepEqual(workRolesFor(saved,'B'),[{label:'SEO 콘텐츠',qty:5}]);
  assert.equal(summarizeWork([saved],'A').review,0);
  assert.equal(totalQty(calcWriterStats([saved]).A),8);
  assert.equal(totalQty(calcWriterStats([saved]).B),5);
  const commonRow = [...unifiedRow]; commonRow[7]='A';
  await importCsvForMonth(fakeDb,csv([unifiedHeaders,unifiedRow,commonRow]),'2026-11');
  assert.deepEqual(imported.new_assignments.map(a=>a.slot),[1,2]);
  assert.equal(summarizeWork([imported.new_assignments[1]],'A').total,13);
  const failingRpc = { ...fakeDb, rpc() { return Promise.resolve({error:{message:'transaction failed'}}); } };
  await assert.rejects(importCsvForMonth(failingRpc,csv([unifiedHeaders,unifiedRow]),'2026-11'),/배정 저장 실패: transaction failed/);
  console.log('PASS: unified Naver/SEO headers, notes, package, clinical reset, strict quantities, month/schema guards and atomic RPC failure without delete fallback');
  console.log('PASS: legacy formats, split/common ownership, no double count/review leakage, invalid quantities, month/schema guards, tab-derived years and month mismatch validation');
  if (process.argv[2]) {
    const values = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const rows = parseCSVRows(csv(values));
    const brand = rows.filter(r => r.packageName === '브랜딩');
    const splitRows = brand.filter(r => r.informationQuantity != null);
    console.log(JSON.stringify({liveRows:rows.length, branding:brand.length, split:splitRows.length, common:brand.length-splitRows.length,
      blogTotal:rows.reduce((n,r)=>n+r.mainQuantity,0),seoTotal:rows.reduce((n,r)=>n+r.subQuantity,0)}));
  }
} finally { rmSync(dir,{recursive:true,force:true}); }
