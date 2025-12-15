export class RequestInterestEntity {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly professionalId: string,
    public readonly message: string | null,
    public readonly createdAt: Date,
  ) {}
}



