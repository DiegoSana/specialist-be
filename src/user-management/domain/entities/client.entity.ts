export class ClientEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly preferences: Record<string, any> | null,
    public readonly savedProfessionals: string[],
    public readonly searchHistory: Record<string, any> | null,
    public readonly notificationSettings: Record<string, any> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  hasSavedProfessional(professionalId: string): boolean {
    return this.savedProfessionals.includes(professionalId);
  }

  addSavedProfessional(professionalId: string): void {
    if (!this.hasSavedProfessional(professionalId)) {
      this.savedProfessionals.push(professionalId);
    }
  }

  removeSavedProfessional(professionalId: string): void {
    const index = this.savedProfessionals.indexOf(professionalId);
    if (index > -1) {
      this.savedProfessionals.splice(index, 1);
    }
  }
}

