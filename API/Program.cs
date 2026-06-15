var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddCors();

var app = builder.Build();

// Configure the HTTP request pipeline.
// if (app.Environment.IsDevelopment())
// {
// }

app.UseCors(x => x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

app.MapControllers();

app.Run();
