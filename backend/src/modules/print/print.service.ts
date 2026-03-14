import { Injectable } from '@nestjs/common';

@Injectable()
export class PrintService {
  getStatus() {
    return {
      module: 'print',
      ok: true,
      message: 'Print module base service ready',
    };
  }
}
