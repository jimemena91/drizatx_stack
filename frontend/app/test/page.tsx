"use client";
export default function TokenTest() {
  return (
    <div className="p-6 space-y-4">
      <div className="p-4 rounded-lg bg-card text-card-foreground border border-border">
        <div className="font-medium">bg-card / text-card-foreground / border-border</div>
        <div className="text-sm text-muted-foreground">Si ves un recuadro con fondo claro/oscuro según tema y borde suave, los tokens están OK.</div>
      </div>
      <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground">Botón primario</button>
      <div className="p-3 rounded-md bg-input-background border border-input">bg-input-background</div>
    </div>
  );
}
