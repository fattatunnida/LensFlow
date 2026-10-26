import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canReadFinance,canReceive,canPayOut,monthRange,moneyErrors,parseMoney,type FinanceBooking,type MoneyValues } from '../src/features/finance/models';
const booking:FinanceBooking={id:'b',code:'BK-1',clientName:'Customer',packageName:'Portrait',date:'2026-11-01',startTime:'09:00',endTime:'10:00',sessionStatus:'confirmed',paymentStatus:'pending_dp',version:1,total:500000,receivedAmount:0,refundedAmount:0,netPaid:0,remaining:500000,collectible:500000,dpTarget:150000,dpPercent:30,refundStatus:'none'};
const values:MoneyValues={kind:'income_dp',amount:'150.000',method:'transfer',effectiveDate:'2026-10-26',description:'',category:'operasional',source:null};
test('money parser accepts whole rupiah and rejects ambiguous separators, exponent, decimals and overflow',()=>{
  for(const [input,result]of [['150000',150000],[' 150.000 ',150000],['1.000.000.000',1000000000]]as const)assert.equal(parseMoney(input),result);
  for(const input of ['','0','-1','1,50','1.5','01','1e3','NaN','Infinity','1 000','1000000001','1..000'])assert.equal(parseMoney(input),null);
});
test('month boundaries use WIB including year rollover and reject invalid month formats',()=>{
  const range=monthRange('2026-12')!;assert.equal(new Date(range.from).toISOString(),'2026-11-30T17:00:00.000Z');assert.equal(new Date(range.to).toISOString(),'2026-12-31T17:00:00.000Z');for(const month of ['2026-13','2026-00','2026-1','bad'])assert.equal(monthRange(month),null);
});
test('DP and settlement validation follow the latest remaining balance and preserve receipt replay',()=>{
  assert.deepEqual(moneyErrors(values,booking),{});assert.ok(moneyErrors({...values,amount:'500000'},booking).amount);assert.deepEqual(moneyErrors({...values,kind:'income_settlement',amount:'500000'},booking),{});assert.ok(moneyErrors({...values,kind:'income_settlement',amount:'400000'},booking).amount);
  const paid={...booking,remaining:0,collectible:0,receivedAmount:500000};assert.ok(moneyErrors(values,paid).booking);assert.deepEqual(moneyErrors(values,paid,true),{});
});
test('refund validation requires source, cancelled lifecycle, positive available amount and reason',()=>{
  const refund={...values,kind:'refund' as const,description:'Returned to customer'};assert.ok(moneyErrors(refund,booking).source);
  const selected={...refund,amount:'50000',source:{id:'original',amount:100000,method:'transfer' as const,effectiveDate:'2026-10-26',refundedAmount:50000,remaining:50000}},cancelled={...booking,sessionStatus:'cancelled' as const};assert.deepEqual(moneyErrors(selected,cancelled),{});assert.ok(moneyErrors({...selected,amount:'50001'},cancelled).amount);assert.ok(moneyErrors({...selected,description:' '},cancelled).description);assert.ok(moneyErrors({...values,effectiveDate:'2026-02-30'},booking).effectiveDate);
});
test('report readers cannot record income, and payments staff cannot record expenses or refunds',()=>{
  const base={uid:'staff',studioId:'studio',role:'staff' as const,crm:false,booking:false};assert.equal(canReadFinance({...base,reports:true}),true);assert.equal(canReceive({...base,reports:true}),false);assert.equal(canReceive({...base,payments:true}),true);assert.equal(canPayOut({...base,payments:true}),false);assert.equal(canPayOut({...base,role:'owner'}),true);assert.equal(canReadFinance(base),false);assert.equal(canReadFinance(null),false);
});
