# docs

Una carpeta por destinatario, porque casi todo lo de acá **se reenvía**: son los
documentos con los que se coordinan tres equipos que no comparten repositorio.

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
