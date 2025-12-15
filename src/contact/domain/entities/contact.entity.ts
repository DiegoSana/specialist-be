export class ContactEntity {
  constructor(
    public readonly id: string,
    public readonly fromUserId: string,
    public readonly toUserId: string,
    public readonly contactType: string,
    public readonly message: string | null,
    public readonly createdAt: Date,
  ) {}
}

