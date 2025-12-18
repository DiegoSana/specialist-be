# Postman Collection Guide

## 📦 Importar la Colección

1. Abre Postman
2. Click en **Import** (botón superior izquierdo)
3. Selecciona los archivos:
   - `Especialistas_API.postman_collection.json` (Colección)
   - `Especialistas_API.postman_environment.json` (Entorno - opcional pero recomendado)

## 🔧 Configurar el Entorno

### Variables del Entorno

- **`base_url`**: URL base de la API
  - Desarrollo: `http://0.0.0.0:5000` (usa `0.0.0.0` en lugar de `localhost` o `127.0.0.1`)
  - Producción: `http://localhost:3000` (o tu URL de producción)

- **`token`**: JWT token (se establece automáticamente después de login)
- **`user_id`**: ID del usuario actual (se establece automáticamente)
- **`user_role`**: Rol del usuario actual (se establece automáticamente)

### Configuración Manual

Si no importas el entorno, puedes crear uno manualmente:

1. Click en el ícono de **engranaje** (⚙️) en la esquina superior derecha
2. Click en **Add** para crear un nuevo entorno
3. Agrega las variables mencionadas arriba

## 🚀 Flujo de Uso Recomendado

### 1. Autenticación

1. **Register - Client** o **Register - Professional**
   - Crea un nuevo usuario
   - El token se guarda automáticamente en la variable `token`

2. **Login**
   - Si ya tienes un usuario, usa este endpoint
   - El token se guarda automáticamente

### 2. Para Clientes (CLIENT role)

1. **Get My Profile** - Ver tu perfil
2. **Search Professionals** - Buscar profesionales
3. **Get Professional by ID** - Ver detalles de un profesional
4. **Create Service Request** - Crear una solicitud de servicio
5. **Get My Requests** - Ver tus solicitudes
6. **Create Review** - Dejar una reseña (después de completar un servicio)

### 3. Para Profesionales (PROFESSIONAL role)

1. **Get All Trades** - Ver oficios disponibles
2. **Create Professional Profile** - Crear tu perfil profesional
3. **Get My Professional Profile** - Ver tu perfil profesional
4. **Update Professional Profile** - Actualizar tu perfil
5. **Get My Requests** - Ver solicitudes recibidas
6. **Update Request Status** - Aceptar/rechazar/completar solicitudes

### 4. Para Administradores (ADMIN role)

1. **Get All Users** - Ver todos los usuarios
2. **Get User by ID** - Ver detalles de un usuario
3. **Update User Status** - Cambiar estado de usuarios (ACTIVE, SUSPENDED, BANNED)
4. **Get All Professionals** - Ver todos los perfiles profesionales
5. **Update Professional Status** - Verificar/rechazar profesionales (VERIFIED, REJECTED)

## 📋 Casos de Uso Completos

### Caso de Uso 1: Cliente busca y contrata un profesional

1. **Register - Client** → Obtener token
2. **Search Professionals** → Buscar por oficio, zona, rating
3. **Get Professional by ID** → Ver detalles completos
4. **Create Service Request** → Crear solicitud de servicio
5. **Get My Requests** → Ver estado de la solicitud
6. (Después de completar el servicio) **Create Review** → Dejar reseña

### Caso de Uso 2: Profesional se registra y crea perfil

1. **Register - Professional** → Crear cuenta
2. **Get All Trades** → Ver oficios disponibles
3. **Create Professional Profile** → Crear perfil con oficio, descripción, etc.
4. **Get My Professional Profile** → Verificar perfil creado
5. **Get My Requests** → Ver solicitudes recibidas
6. **Update Request Status** → Aceptar solicitud (status: ACCEPTED)
7. **Update Request Status** → Completar trabajo (status: DONE)

### Caso de Uso 3: Admin verifica profesionales

1. **Login** (como admin) → Obtener token
2. **Get All Professionals** → Ver profesionales pendientes
3. **Get Professional by ID** → Revisar detalles
4. **Update Professional Status** → Verificar (status: VERIFIED) o rechazar (status: REJECTED)

### Caso de Uso 4: Contacto entre usuarios

1. **Login** → Obtener token
2. **Search Professionals** → Encontrar profesional
3. **Get Professional by ID** → Obtener userId del profesional
4. **Create Contact Request** → Enviar mensaje de contacto

## 🔐 Autenticación

Todos los endpoints protegidos requieren el header:

```
Authorization: Bearer {{token}}
```

Postman lo maneja automáticamente si:
- Has importado el entorno
- Has ejecutado un endpoint de login/register (el token se guarda automáticamente)

## 📝 Notas Importantes

### Valores de Enums

**UserRole:**
- `CLIENT`
- `PROFESSIONAL`
- `ADMIN`

**UserStatus:**
- `PENDING`
- `ACTIVE`
- `SUSPENDED`
- `BANNED`

**ProfessionalStatus:**
- `PENDING_VERIFICATION`
- `VERIFIED`
- `REJECTED`

**RequestStatus:**
- `PENDING`
- `ACCEPTED`
- `IN_PROGRESS`
- `DONE`
- `CANCELLED`

### Endpoints Públicos (sin autenticación)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/trades`
- `GET /api/trades/:id`
- `GET /api/professionals`
- `GET /api/professionals/:id`
- `GET /api/professionals/:professionalId/reviews`

### Endpoints que Requieren Autenticación

Todos los demás endpoints requieren JWT token.

### Endpoints Específicos por Rol

- **CLIENT**: Puede crear requests y reviews
- **PROFESSIONAL**: Puede crear/actualizar su perfil y gestionar requests
- **ADMIN**: Acceso completo a endpoints de administración

## 🧪 Testing

Cada request de autenticación tiene un script de test que:
- Guarda automáticamente el `token` en la variable de entorno
- Guarda el `user_id` y `user_role` para uso posterior

Puedes agregar más tests personalizados en la pestaña **Tests** de cada request.

## 🔄 Actualizar Variables

Si necesitas cambiar el `base_url` o usar un token diferente:

1. Selecciona el entorno en el dropdown superior derecho
2. Click en el ícono de **ojo** (👁️) para ver/editar variables
3. Modifica los valores necesarios

## 📚 Estructura de la Colección

```
Especialistas API
├── Authentication
│   ├── Register - Client
│   ├── Register - Professional
│   ├── Register - Admin
│   └── Login
├── User Management
│   ├── Get My Profile
│   └── Update My Profile
├── Service - Trades
│   ├── Get All Trades
│   └── Get Trade by ID
├── Service - Professionals
│   ├── Search Professionals
│   ├── Get Professional by ID
│   ├── Get My Professional Profile
│   ├── Create Professional Profile
│   └── Update Professional Profile
├── Service - Requests
│   ├── Create Service Request
│   ├── Get My Requests
│   ├── Get Request by ID
│   └── Update Request Status
├── Reputation - Reviews
│   ├── Get Professional Reviews
│   ├── Get Review by ID
│   ├── Create Review
│   ├── Update Review
│   └── Delete Review
├── Contact
│   ├── Create Contact Request
│   └── Get My Contacts
└── Admin
    ├── Get All Users
    ├── Get User by ID
    ├── Update User Status
    ├── Get All Professionals
    └── Update Professional Status
```

## 🐛 Troubleshooting

### Error 401 Unauthorized
- Verifica que el token esté guardado en la variable `token`
- Asegúrate de haber ejecutado login/register primero
- Verifica que el token no haya expirado (por defecto expira en 7 días)

### Error 403 Forbidden
- Verifica que tu usuario tenga el rol correcto para el endpoint
- Algunos endpoints requieren roles específicos (ADMIN, PROFESSIONAL, CLIENT)

### Error 404 Not Found
- Verifica que el `base_url` sea correcto
- Asegúrate de que la API esté corriendo
- Verifica que los IDs en los parámetros sean válidos

### Variables no se actualizan
- Asegúrate de tener el entorno correcto seleccionado
- Verifica que los scripts de test estén ejecutándose correctamente

## 📞 Soporte

Si encuentras problemas o necesitas agregar más endpoints, revisa:
- `README.md` - Documentación general de la API
- Controladores en `src/*/presentation/*.controller.ts` - Endpoints disponibles

