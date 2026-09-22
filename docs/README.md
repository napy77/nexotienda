# docs

Dos cosas distintas viven acá.

## 1. La memoria del proyecto

Documentación técnica del sistema. **Es lo que una sesión nueva tiene que leer**, y lo
que hay que actualizar cuando algo cambia.

| Archivo | Cuándo leerlo |
|---|---|
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | **Siempre**, junto a `../CLAUDE.md` |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Estructura, rutas, flujos, autenticación |
| [`API_CONTRACTS.md`](API_CONTRACTS.md) | Antes de tocar `src/lib/nexopos/types.ts` |
| [`INTEGRATIONS.md`](INTEGRATIONS.md) | Quién manda qué a quién |
| [`DATABASE.md`](DATABASE.md) | Ids compartidos y de quién es cada dato |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Servidores, variables, TLS, rollback |
| [`DECISIONS.md`](DECISIONS.md) | Por qué algo es como es, antes de cambiarlo |

## 2. La coordinación con los otros equipos

Una carpeta por destinatario, porque casi todo eso **se reenvía**: son los documentos
con los que se coordinan tres equipos que no comparten repositorio.

| Carpeta | Para quién | Regla |
|---|---|---|
| `a-nexopos/` | El equipo de NexoPOS | Se manda tal cual, sin editar |
| `a-clubpay/` | El equipo de ClubPay | Se manda tal cual, sin editar |
| `interno/` | Nosotros | No se manda. Es por qué se decidió algo |

Y cada archivo lo dice otra vez en su primera línea, para el que lo abre suelto.

## Las dos reglas que hacen que esto sirva

**Cada archivo tiene que poder leerse solo.** Si ClubPay y NexoPOS tienen que
entender la misma cadena de llamadas, va escrita en los dos. Diez líneas repetidas
cuestan menos que un equipo leyendo instrucciones que no son suyas y construyendo la
parte del otro.

**Un archivo, un destinatario.** Un documento para los dos a la vez no se puede
reenviar sin editarlo, que es el único uso que tiene. Si algo le toca a los dos, se
parte — como pasó con la libreta.

## El orden de las cosas

Los de NexoPOS van numerados (`nexopos-2`, `nexopos-3`…) porque son tandas y el orden
importa. Los `respuesta-*` contestan lo que ellos mandaron sobre esa tanda.
