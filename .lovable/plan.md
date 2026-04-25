
# Sistema Expresso Pizza e Esfirra

Sistema completo com cardápio online para clientes (envio via WhatsApp) e painel interno para garçons gerenciarem mesas e comandas, com relatórios segmentados por categoria.

## 1. Site público (cliente)

**Página inicial / Cardápio**
- Cabeçalho com logo "Expresso Pizza e Esfirra", endereço (R. Vig. Antônio Jorge, 46 - São Francisco, Caruaru-PE), horário (16h às 23h) e telefone.
- Visual inspirado no cardápio físico: fundo escuro tipo "lousa", títulos em laranja/amarelo, preços em destaque.
- Categorias em abas/seções: **Pizzas Salgadas**, **Pizzas Doces**, **Esfirras Assadas**, **Esfirras Doces**, **Hambúrgueres**, **Bebidas**, **Sobremesas**.
- Cada pizza mostra nome, ingredientes e os 4 tamanhos (P / M / G / GG) com preços.
- Bordas recheadas (Cheddar, Catupiry, Cream Cheese, Chocolate) selecionáveis como adicional.

**Carrinho**
- Botão flutuante mostrando quantidade e total.
- Ajuste de quantidade, observações por item, remover item.
- Subtotal + taxa de entrega (se delivery) + taxa de cartão (se pagamento em cartão na entrega) = total.

**Checkout**
- Dados: nome, telefone.
- Tipo: **Delivery** (pede endereço + bairro) ou **Retirar na loja**.
- Forma de pagamento: Dinheiro (com troco para), Pix, Cartão (aplica taxa de cartão configurável).
- Botão "Enviar pedido pelo WhatsApp" — abre o WhatsApp da loja (**81 98975-7972**) com mensagem formatada contendo todos os itens, endereço, forma de pagamento e total.

## 2. Painel interno (garçons / admin)

**Login** com email e senha. Dois papéis: `garcom` e `admin`.

**Tela de Mesas (garçom)**
- Grade de mesas (configurável quantas). Cores: livre / ocupada / aguardando pagamento.
- Toque na mesa abre a **comanda**: lista de itens já pedidos + botão "Adicionar item" que abre o cardápio em modo rápido (busca por nome, categoria, tamanho).
- Cada item lançado fica vinculado ao garçom logado.
- Botão "Fechar conta": calcula total, escolhe forma de pagamento, marca mesa como livre e registra a venda.

**Pedidos online recebidos**
- Lista de pedidos vindos do site (quando o cliente confirma envio, também grava no sistema antes de abrir o WhatsApp), com status: novo / em preparo / pronto / entregue.

**Admin — Cardápio**
- CRUD de categorias (grupos de venda) e produtos.
- Para pizzas/esfirras: nome, descrição, categoria, preços por tamanho.
- Para hambúrgueres/bebidas/sobremesas: nome, descrição, preço único.
- Bordas como adicionais configuráveis.
- Configuração de **taxa de entrega** (valor fixo ou por bairro) e **taxa de cartão** (% sobre o total).

**Admin — Relatórios**
- Filtro por período (hoje, ontem, semana, mês, customizado).
- Total de vendas no período.
- **Quebra por categoria/grupo de venda** (Pizzas Salgadas, Pizzas Doces, Esfirras Assadas, Esfirras Doces, Hambúrgueres, Bebidas, Sobremesas, Taxa de Entrega, Taxa de Cartão) com valor e %.
- Quebra por garçom, por mesa, por forma de pagamento, por canal (online vs salão).
- Itens mais vendidos.
- Exportar CSV.

## 3. Conteúdo inicial do cardápio (já cadastrado)

Pizzas salgadas (Mussarela, Calabresa, Três Queijos, Quatro Queijos, Frango c/ Catupiry, Frango c/ Cheddar, Portuguesa, Mista, Atum, Calabacon, Peperone, Lombo Canadense, Nordestina, Charque, Camarão, Moda da Casa) com preços P/M/G/GG conforme as fotos.
Pizzas doces (M&M's, Brigadeiro, Morango, Sonho de Valsa, Cartola, Kitkat, Choconana) — 30/35/40/50.
Esfirras assadas (Carne, Mussarela, Queijo Branco, Atum, Bacon, Frango c/ Catupiry, Charque, Napolitana, Quatro Queijos, Peperone, Camarão) — R$ 5,00.
Esfirras doces (Morango, Choconana, Sonho de Valsa, Cartola, Kitkat, Brigadeiro, M&M) — R$ 6,00.
Bordas: Cheddar R$6, Catupiry R$6, Cream Cheese R$10, Chocolate R$10.
Hambúrgueres e bebidas: cadastro vazio inicial pronto para o admin preencher.

## 4. Detalhes técnicos

- **Backend:** Lovable Cloud (Supabase) com tabelas: `categories`, `products`, `product_sizes`, `addons`, `tables`, `orders`, `order_items`, `user_roles` (enum `admin`/`garcom`), `settings` (taxas, telefone WhatsApp).
- **Auth:** email/senha via Lovable Cloud. Papéis em tabela separada `user_roles` com função `has_role()` (security definer) para RLS.
- **RLS:** clientes do site usam edge function pública para gravar pedidos online; garçons só veem/editam pedidos próprios + mesas; admin vê tudo.
- **WhatsApp:** link `https://wa.me/5581989757972?text=<mensagem urlencoded>` aberto após persistir o pedido.
- **Stack:** React + Vite + Tailwind + shadcn/ui (já no projeto), React Router, Tanstack Query.
- **Responsivo:** mobile-first (clientes pedem pelo celular; garçons usam tablet/celular).

## 5. Fora do escopo desta versão

- Pagamento online (Stripe/Pix integrado) — pedido vai por WhatsApp.
- KDS (painel da cozinha em tela separada) — pode ser adicionado depois.
- App nativo — é web app responsivo.
