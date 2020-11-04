import { IOProcessController, IOProcessStatus } from '../manager/model';
import { EventEmitter } from 'events';

export enum IOEvent {
    Status = 'status',
    Abort = 'abort'
}

export class ProcessController implements IOProcessController {

    private _status: IOProcessStatus;

    constructor(private readonly eventEmitter: EventEmitter, initialStatus: IOProcessStatus) {
        this._status = initialStatus;
        this.eventEmitter.addListener(IOEvent.Status, (newStatus: IOProcessStatus) => this._status = newStatus);
    }

    public async abort() {
        this.eventEmitter.emit(IOEvent.Abort);
    }

    public async status(): Promise<IOProcessStatus> {
        return this._status;
    }

    public async addStatusListener(handler: (status: IOProcessStatus) => Promise<void>) {
        this.eventEmitter.addListener(IOEvent.Status, handler);
    }
}
