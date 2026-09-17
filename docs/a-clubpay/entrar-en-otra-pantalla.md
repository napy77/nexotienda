# ClubPay → abrir la libreta en la computadora

> **Para el equipo de ClubPay.** Este archivo se manda tal cual.
>
> *Reemplaza a la versión anterior, que tenía el código naciendo en la computadora. Si
> ya empezaron con esa, paren: la dirección se invirtió y quedó más simple.*

El caso: **la tienda abierta en la computadora de casa y ClubPay en el celular.** El
handoff que armamos no sirve ahí —abre la tienda *en el teléfono*— y la computadora no
tiene forma de demostrar quién es.

Hoy, en esa situación, la libreta no se puede usar.

---

## El circuito

```
1. En el teléfono    ClubPay → Mis comercios → Jure Hnos SRL
                     → "Entrar en otra pantalla"
                     → la app muestra:  VRCCX

2. En la computadora la persona lo tipea en la tienda

3. La tienda canjea  NexoTienda → NexoPOS → ClubPay
                     { storeId, code }  →  { token }

4. Se abre la sesión con el MISMO token de un solo uso del handoff que ya existe
```

Nada de sondeo, nada de pedidos pendientes: la compu manda el código y recibe el token,
o no. **El paso 4 es a propósito**: termina en el canje que ya construimos y probamos.
Una segunda forma de abrir sesión sería una segunda superficie que auditar, y esta es
la parte del sistema donde eso menos conviene.

De este lado ya está construido y andando: la pantalla de libreta, cuando no hay
sesión, ofrece un campo para el código y abre la libreta al tipearlo.

## Por qué el código nace en la app y no en la computadora

Nuestra primera versión lo tenía al revés, y el equipo de NexoPOS nos mostró por qué
estaba mal. Vale la pena que lo sepan porque es el motivo de toda la forma:

**El ataque de un mecanismo así no es que le roben el código a alguien.** Es que el
atacante abra el pedido en *su* computadora y convenza a la víctima de meter *ese*
código en su ClubPay.

Con el código naciendo en la compu, lo que le pedimos a la persona es *"escribí este
código en tu app"* — una acción que se siente tan inofensiva como emparejar un
televisor, y contra la que nadie fue entrenado nunca.

Con el código naciendo en la app, el atacante necesita que la víctima **le dicte** un
código que tiene en su teléfono. Y eso sí tiene diez años de entrenamiento encima:
*"nunca le des tu código a nadie"* lo repiten todos los bancos del país.

**No elimina el ataque: lo muda a un terreno donde la gente ya está parada.** Es todo
lo que se puede decir con honestidad de un mecanismo de emparejar pantallas, y
preferimos decirlo así antes que prometer de más.

## Lo que les toca

**Una pantalla en la app**: "Entrar en otra pantalla", dentro del comercio en Mis
comercios. Muestra el código y **el aviso al lado**, que es donde la persona está
mirando:

> **VRCCX**
> Este código abre tu libreta de Jure Hnos SRL en otra pantalla.
> Nadie de Jure ni de ClubPay te lo va a pedir. Si alguien te lo pide, no se lo des.

**Un endpoint**, que va a llamar NexoPOS con la clave de ese comercio (nosotros no
hablamos con ustedes directo, por lo de siempre: no tenemos ni podemos tener una clave
por comercio):

```
POST …/emparejar/canjear   { code, storeId }   →  { token }
```

El `token` es el mismo que emite hoy `POST /me/merchants/:vinculacion_id/tienda`. No
hace falta uno nuevo.

Tres detalles:

- **El código nace atado a una relación y a un comercio.** Si `storeId` no coincide,
  rechácenlo: así un código de Jure tipeado en la tienda de Delfín falla solo.
- **Cinco minutos y un solo uso.** El tiempo de caminar del teléfono al escritorio.
- **Límite de intentos.** Cinco caracteres se prueban a mano si se puede intentar mil
  veces. **Este límite solo lo pueden poner ustedes**: NexoTienda no guarda estado y
  contarlos mal sería peor que no contarlos, porque daría la sensación de que el
  problema está cubierto.

Y una sugerencia sobre el alfabeto: **sin vocales**, para que no se arme ninguna
palabra sola, y sin 0 ni O. Nosotros usamos `34679BCDFGHJKLMNPQRSTVWXZ`.

## Lo que ya no hace falta

De la versión anterior caen: el pedido pendiente, el estado "pendiente/listo/vencido",
el sondeo, y la descripción del dispositivo. Esa última la habíamos propuesto como
defensa y **no lo era** —en ese ataque el que abre el pedido es el atacante, así que
esa cadena la escribía él—. Con la dirección invertida no hay dónde ponerla ni hace
falta.
