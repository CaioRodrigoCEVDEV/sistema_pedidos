import 'package:flutter/material.dart';
import 'screens/produtos_screen.dart';

void main() {
  runApp(const JPApp());
}

class JPApp extends StatelessWidget {
  const JPApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JP Peças',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.redAccent),
        useMaterial3: true,
      ),
      home: const ProdutosScreen(),
    );
  }
}
