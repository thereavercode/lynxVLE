declare module 'zeptomail' {
    export class SendMailClient {
        constructor(options: {
            url: string;
            token: string;
        });
        send(params: any): Promise<any>;
        sendMail(params: any): Promise<any>;
        sendMailWithTemplate(params: any): Promise<any>;
        sendBatchMail(params: any): Promise<any>;
    }
}
