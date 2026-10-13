-- Orden a mano de las subtareas dentro de su padre (épica o tarea); null = sin ordenar a mano.
ALTER TABLE "task" ADD COLUMN "sub_order" DOUBLE PRECISION;
