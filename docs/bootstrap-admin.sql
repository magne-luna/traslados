UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'andrea.test@gmail.com';
UPDATE usuarios.usuarios SET rol = 'admin' WHERE email = 'andrea.test@gmail.com';
