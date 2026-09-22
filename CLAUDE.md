# NexoTienda — instrucciones de sesión

Tienda online del comerciante de pueblo. **Web pública, sin app propia**, una por
comercio, en su propio subdominio.

## Qué hace y qué no

Es **la vidriera**, no el sistema. No tiene base de datos: el catálogo, el stock, los
precios, los pedidos y las cuentas corrientes viven en **NexoPOS**; la identidad y la
libreta del comprador viven en **ClubPay**. NexoTienda lee, muestra y escribe contra
esas APIs.

En el ecosistema: **Nexo B2B** (catálogo maestro y mayoristas) → **NexoPOS** (el
sistema del comercio) → **NexoTienda** (su tienda online) · **ClubPay** (billetera y
fidelización; identidad del comprador).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · systemd + nginx.
Sin base de datos. Sin ORM. Estado propio: cookies `httpOnly` y `localStorage`.

## Estructura

```
src/app/            rutas. Todo cuelga de /s/[sub]/ — el subdominio lo reescribe proxy.ts
src/components/     UI
src/lib/nexopos/    el contrato con NexoPOS: types.ts (port), client.ts (HTTP), fixtures.ts
src/lib/payments/   el riel de cobro: port + mercadopago + sandbox
src/lib/*.ts        reglas: horario, cerrado, credit, libreta, session, slug, arbol
deploy/             scripts de despliegue y diagnóstico
docs/               documentación (ver abajo)
contexto/           PDFs de negocio. NO analizar salvo pedido explícito
```

## Reglas críticas que nunca se rompen

1. **Libro y riel, no balance (P1).** El acreedor es siempre el comercio. La plata va
   del comprador al comercio por el Mercado Pago **del comercio**. Nunca por una
   cuenta nuestra.
2. **No somos cobradores (P2).** Nada de avisos de mora ni recordatorios escalados.
3. **Ningún comercio ve la deuda de un cliente con otro comercio (P3).** El
   `accountId` es de la **relación**, no de la persona. No existe una clave que
   identifique al comprador a través del pueblo.
4. **Describir no es calificar (P4).** Nada de scoring ni recomendaciones de riesgo.
5. **No afirmar lo que no se puede respaldar (P5).** Dato ausente se declara ausente.
   Nunca "nadie tiene X"; sí "no lo encontramos cargado".
6. **Un número equivocado con autoridad es peor que no tener número (P6).** Si un dato
   no vino, no se inventa ni se rellena con cero: no se muestra la línea.
7. **El precio y los totales los calcula NexoPOS.** Acá nunca se multiplica un
   descuento ni se suma una deuda.
8. **NexoTienda nunca autentica a nadie.** Recibe una prueba de ClubPay, la canjea del
   lado del servidor y abre una libreta. Sin contraseñas, sin usuarios propios.
9. **NexoTienda no llama nunca a ClubPay directo.** La cadena es
   NexoTienda → NexoPOS → ClubPay.
10. **Español rioplatense**, concreto. No se le dice "crédito" al fiado ni "moroso" a
    nadie. El interlocutor es un almacenero de pueblo o su cliente.

El resto de las decisiones numeradas (`D1`–`D44`) vive en el documento fundacional y
está resumido en `docs/DECISIONS.md`.

## Antes de modificar algo

1. Leer este archivo.
2. Leer `docs/CURRENT_STATE.md`.
3. Leer **solo** los documentos relacionados con la tarea (tabla de abajo).
4. No recorrer el repositorio entero.
5. No analizar `node_modules`, `.next`, `tsconfig.tsbuildinfo`, `contexto/`, ni nada
   generado.
6. No leer otros proyectos del ecosistema salvo que la tarea sea una integración.

## Qué leer según la tarea

| Tarea | Documentos |
|---|---|
| Cualquiera | `CLAUDE.md` + `docs/CURRENT_STATE.md` |
| Tocar el contrato con NexoPOS | `docs/API_CONTRACTS.md`, `src/lib/nexopos/types.ts` |
| Integraciones, quién manda qué | `docs/INTEGRATIONS.md` |
| Entender por qué algo es así | `docs/DECISIONS.md` |
| Estructura, flujos, componentes | `docs/ARCHITECTURE.md` |
| Datos, ids, ownership | `docs/DATABASE.md` |
| Desplegar, servidores, TLS | `docs/DEPLOYMENT.md` |
| Mandarle algo a otro equipo | `docs/README.md` y la carpeta `a-<equipo>/` |

## Cómo se trabaja

- **Despliegue manual.** Después de pushear, el comando va explícito en la respuesta:
  `sudo bash /opt/nexotienda/deploy/deploy.sh`. Pushear no es desplegar.
- **Verificar antes de afirmar.** `npm run lint` (es `tsc --noEmit`) y `npx next build`.
  Si algo se puede comprobar con un `curl` o levantando el server, se comprueba.
- **Un archivo de `docs/a-*` tiene un solo destinatario** y se reenvía tal cual.
- Al terminar una tarea que cambie el estado del sistema, actualizar
  `docs/CURRENT_STATE.md` y, si corresponde, `docs/DECISIONS.md`.
