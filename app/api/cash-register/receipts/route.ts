import {saveCashRegisterReceipt} from '@/lib/cash-register-save';
export async function POST(request: Request) {return saveCashRegisterReceipt(request);}
