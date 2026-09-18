# Emparejar: qué esperamos de ustedes, y qué no

> **Para el equipo de ClubPay.** Este archivo se manda tal cual.

Ustedes dicen que su mitad está y que falta la nuestra. La nuestra está construida y
desplegada. Antes de seguir discutiendo, esto ordena el circuito — porque **es probable
que los dos tengamos razón y el hueco esté en el medio.**

---

## Lo primero, porque puede ser todo el malentendido

**NexoTienda no los llama a ustedes. Nunca.**

```
NexoTienda  →  NexoPOS  →  ClubPay
```

Su primer documento proponía `NexoTienda → POST /pos/tienda/sessions` con
`X-API-Key: la clave de ese comercio`. **No podemos usar eso**, y por eso quedó
NexoPOS en el medio: NexoTienda tiene tres claves separadas por capacidad —catálogo,
pedidos, cuentas— y **ninguna por comercio**, porque es *un solo servidor que renderiza
la tienda de cualquier comercio*. Con cuatrocientas tiendas serían cuatrocientas claves
de ClubPay adentro del proceso que atiende a las cuatrocientas.

Quien sí tiene legítimamente una clave por comercio es NexoPOS.

**Si están esperando una llamada nuestra, no va a llegar nunca**, y ese sería el
malentendido entero. La llamada que tienen que ver es de NexoPOS.

## Lo que ya sabemos que funciona

La libreta **se abre bien** desde Mis comercios → Ir a la tienda. Germán lo probó hoy.

Ese camino termina en **su** `POST /pos/tienda/sessions`, llamado por NexoPOS con la
clave del comercio. O sea: el enlace entre ustedes y NexoPOS **está probado y
andando**. No hay nada roto en la plomería.

## Lo que no funciona

El emparejamiento con código. Nosotros llamamos a NexoPOS y no vuelve nada útil.

## Las dos preguntas, que son todo lo que necesitamos

1. **¿Les llegó alguna vez una petición a `/pos/tienda/emparejar`?** Miren el log. Un
   sí o un no cierra el caso:
   - **Sí, y contestamos bien** → el problema está entre NexoPOS y nosotros.
   - **Sí, y contestamos error** → díganos cuál y lo arreglamos entre los tres.
   - **No llegó nunca** → el tramo del medio no está construido. Es de NexoPOS y ya se
     lo pedimos.

2. **Confirmen el contrato exacto de sus dos endpoints**: ruta, método, cabecera de
   autenticación y forma de la respuesta. No para nosotros —no los llamamos— sino
   **para que NexoPOS los enchufe sin adivinar**. Su documento dice
   `POST /pos/tienda/emparejar` y `GET /pos/tienda/emparejar/:request_id`; si es
   exactamente eso, con un "sí" alcanza.

## Lo que no les estamos pidiendo

**No cambien la dirección del código.** Quedó como ustedes la defendieron: nace en la
computadora y se tipea en la app. Ya está revertido, desplegado y probado de nuestro
lado.

**No agreguen el `storeId` al canje.** Se resolvió mandándolo en el pedido.

## Lo que sí sigue esperando, y no tiene que ver con esto

1. `storefrontSlug` y `storefrontPublished` en la ficha del comercio.
2. Los dos botones apuntando a `/entrar?t=<token>` —y con `&ir=libreta` el de la
   cuenta—. Está en [libreta.md](libreta.md), sección 3.
3. La pantalla "Entrar en otra pantalla" con el campo para el código.

El 3 es el que cierra el emparejamiento una vez que el tramo del medio exista.
