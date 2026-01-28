description: Procedimiento para procesar la cola local de datos y sincronizarla con el servidor cuando se recupera la conexión.



Procedimiento: Sincronización de Cola Offline



Sigue estos pasos para implementar o depurar el sistema de recuperación de datos.



1. Lectura de la Cola



Accede al almacenamiento local (localStorage key: offline\_queue o IndexedDB).



Lee los items pendientes. Si está vacía, termina el proceso.



2\. Ordenamiento Cronológico (FIFO)



Ordena las operaciones por timestamp. Es crítico procesar los fichajes o incidencias en el orden exacto en que ocurrieron para no corromper el estado del empleado.



3\. Procesamiento Secuencial



Itera sobre cada item:



Intenta enviar a la API/Firebase.



Éxito: Elimina el item de la cola local y marca como "Sincronizado".



Fallo (Error 4xx/5xx): - Si es error de validación (400), marca como "Error Conflicto" y alerta al usuario (no reintentar infinitamente).



Si es error de servidor (500), mantén en cola para el siguiente ciclo.



4\. Feedback de UI



Al iniciar: Muestra "Sincronizando X cambios...".



Al finalizar: Muestra "Todo actualizado" y refresca las vistas afectadas (Dashboard/Cuadrante).



5\. Verificación de Integridad // turbo



Verifica que el número de registros en la base de datos coincida con los esperados tras la sincronización.

