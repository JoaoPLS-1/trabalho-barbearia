# Contribuição ao projeto

Cada microcommit deve representar uma alteração pequena, revisável e relacionada a uma única tarefa.

Antes de commitar, conferir a identidade local, selecionar os arquivos da tarefa e revisar o conteúdo preparado:

```bash
git config --get user.name
git config --get user.email
git diff --cached
git diff --cached --check
```

Executar as verificações pertinentes à mudança. Arquivos de ambiente com segredos e alterações locais sem relação com a tarefa não devem entrar no commit.

A autoria do commit usa nome e email configurados no Git. A conta que autentica o push é independente dessa autoria.
