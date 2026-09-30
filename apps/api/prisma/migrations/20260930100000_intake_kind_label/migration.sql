-- Tipo de formulario público (textos de sucursal o de aplicación) y etiqueta propia del desplegable.
ALTER TABLE "project" ADD COLUMN "intake_kind" TEXT NOT NULL DEFAULT 'sucursal';
ALTER TABLE "project" ADD COLUMN "intake_label" TEXT;
