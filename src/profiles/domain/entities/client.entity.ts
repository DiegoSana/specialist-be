export class ClientEntity {
  static createForUser(params: {
    id: string;
    userId: string;
    now?: Date;
  }): ClientEntity {
    const now = params.now ?? new Date();
    return new ClientEntity(
      params.id,
      params.userId,
      null,
      [],
      null,
      null,
      now,
      now,
    );
  }

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

  withChanges(changes: {
    preferences?: Record<string, any> | null;
    savedProfessionals?: string[];
    searchHistory?: Record<string, any> | null;
    notificationSettings?: Record<string, any> | null;
    now?: Date;
  }): ClientEntity {
    const now = changes.now ?? new Date();
    return new ClientEntity(
      this.id,
      this.userId,
      changes.preferences !== undefined
        ? changes.preferences
        : this.preferences,
      changes.savedProfessionals !== undefined
        ? changes.savedProfessionals
        : this.savedProfessionals,
      changes.searchHistory !== undefined
        ? changes.searchHistory
        : this.searchHistory,
      changes.notificationSettings !== undefined
        ? changes.notificationSettings
        : this.notificationSettings,
      this.createdAt,
      now,
    );
  }

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
