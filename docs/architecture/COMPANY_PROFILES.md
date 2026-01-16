# Company Profiles - Diseño y Arquitectura

> Última actualización: 2026-01-16

## Resumen

Este documento describe el diseño del sistema de perfiles de empresa, incluyendo la relación con perfiles profesionales individuales, flujos de registro, y reglas de negocio.

---

## Decisiones de Arquitectura

### Catálogo Unificado con Filtro

El catálogo de especialistas muestra tanto Professionals como Companies en una vista unificada.

- **Filtro disponible:** Todos | Individual | Empresa
- **Badge visual:** Las empresas muestran badge "Empresa" distintivo
- **Mismo endpoint de búsqueda** con query param `providerType`

### Solo Un Perfil Activo (Professional XOR Company)

Un usuario puede tener ambos perfiles, pero **solo uno puede estar activo** a la vez.

```
┌─────────────────────────────────────────┐
│            Usuario                       │
├─────────────────────────────────────────┤
│  ├── Perfil Cliente (independiente)     │
│  │                                       │
│  └── Perfil Proveedor (solo 1 activo)   │
│       ├── Professional (ACTIVE/INACTIVE)│
│       └── Company (PENDING/ACTIVE/...)  │
└─────────────────────────────────────────┘
```

**Regla:** Si se activa Professional → se desactiva Company (y viceversa)

---

## Flujos de Usuario

### 1. Registro Inicial

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRO                              │
├─────────────────────────────────────────────────────────┤
│  ¿Qué querés hacer en Specialist?                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 🔍 Buscar   │  │ 👤 Ofrecer  │  │ 🏢 Ofrecer  │      │
│  │  servicios  │  │  servicios  │  │  como       │      │
│  │  (Cliente)  │  │ (Individual)│  │  empresa    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 2. Professional que crea Empresa

```
1. Usuario tiene Professional (ACTIVE) con historial de reviews
2. Crea Company → Company queda PENDING
   ⚠️ Warning: "Tu perfil profesional se desactivará cuando la empresa sea verificada"
3. Professional sigue ACTIVE mientras Company está PENDING
4. Admin verifica Company (valida CUIT + nombre)
5. Company → ACTIVE, Professional → INACTIVE automáticamente
6. Reviews y trabajos del Professional quedan en su historial (separados)
7. Company empieza con 0 reviews (historial independiente)
```

### 3. Alternancia entre Perfiles

El usuario puede alternar entre perfiles activos desde su dashboard:

```
Dashboard
├── Mi perfil activo: [Juan Plomería SRL] 🏢
│   └── [Cambiar a perfil individual]
│
└── Perfil inactivo: Juan Pérez (15 reviews, ⭐4.8)
    └── Al activar: Company se desactiva
```

### 4. Empresa ya existente

```
1. Dueño se registra
2. Crea Company con datos de la empresa
3. Company → PENDING
4. Admin verifica (CUIT único, nombre)
5. Company → ACTIVE
6. Dueño es OWNER (futuro: puede invitar empleados)
```

---

## Reglas de Negocio

### Unicidad de Empresa

| Campo | Regla |
|-------|-------|
| CUIT | Único en el sistema |
| Nombre | No necesariamente único (dos "Construcciones Sur" pueden existir) |

**Si CUIT ya existe:** Error "Esta empresa ya está registrada"

### Verificación de Company

**MVP:**
- CUIT (formato argentino: XX-XXXXXXXX-X)
- Nombre de empresa

**Futuro:**
- Constancia de inscripción AFIP
- Poder del representante legal
- Domicilio fiscal

**Timeout:** Ninguno por ahora. Futuro: reminder a admin si pendientes > X días.

### Estados de Company

```
PENDING ──────► ACTIVE ──────► VERIFIED
    │              │               │
    │              ▼               │
    │         SUSPENDED ◄──────────┘
    │              │
    ▼              ▼
 (eliminado)  (eliminado)
```

| Estado | Descripción | Puede operar |
|--------|-------------|--------------|
| PENDING | Recién creada, esperando verificación | ❌ |
| ACTIVE | Verificada, puede operar | ✅ |
| VERIFIED | Verificada + badge especial | ✅ + badge |
| SUSPENDED | Suspendida por admin | ❌ |

---

## Flujos Operativos

### Job Board (Bolsa de Trabajo)

Company funciona igual que Professional:
- Ve requests públicos de sus rubros
- Puede expresar interés
- Aparece en lista de interesados con badge "Empresa"

### Solicitud Directa

Cliente puede enviar solicitud directa a Company (igual que a Professional).

### Reviews

- Reviews se asocian al ServiceProvider
- Company y Professional tienen historiales independientes
- Mismo flujo de moderación (PENDING → APPROVED/REJECTED)

---

## Modelo de Datos

```
ServiceProvider (abstracción)
├── id
├── type: PROFESSIONAL | COMPANY
├── averageRating
├── reviewCount
│
├── Professional? (1:1)
│   ├── userId
│   ├── displayName
│   ├── status: ACTIVE | INACTIVE | SUSPENDED
│   └── trades[]
│
└── Company? (1:1)
    ├── userId
    ├── companyName
    ├── legalName
    ├── taxId (CUIT, único)
    ├── status: PENDING | ACTIVE | VERIFIED | SUSPENDED
    └── trades[]
```

---

## Futuro (Post-MVP)

### Multi-Usuario por Empresa

```prisma
model CompanyMember {
  id        String      @id
  companyId String
  userId    String
  role      CompanyRole // OWNER, ADMIN, MEMBER
  invitedAt DateTime
  joinedAt  DateTime?
}
```

- OWNER: quien registró (único, no transferible inicialmente)
- ADMIN: puede gestionar empresa y miembros
- MEMBER: puede actuar en nombre de la empresa

### Verificación Avanzada

- Documentación legal automatizada
- Integración con AFIP para validar CUIT
- Verificación de domicilio

### Transferencia de Ownership

- Proceso formal para cambiar dueño de empresa
- Requiere verificación de identidad

---

## Referencias

- [ADR-004: ServiceProvider Abstraction](../decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md)
- [ADR-001: Dual Profile Architecture](../decisions/ADR-001-DUAL-PROFILE-ARCHITECTURE.md)

