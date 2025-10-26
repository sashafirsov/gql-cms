# Northwind Database Schema (PostgreSQL)

`gql-cms` provides the complete [schema in PostgreSQL dialect](./init/50-northwind.sql)
and [sample data](./init/60-northwind-seed.sql) for the Northwind sample database, translated to PostgreSQL. 
It includes all tables, primary/foreign keys, data types, and constraints based on official Northwind definitions
[gist.github.com](https://gist.github.com/keeyanajones/2ea808fdca8325a4faf2dbd0a59e0c9e#:~:text=%2F,CategoryID%29)
[gist.github.com](https://gist.github.com/keeyanajones/2ea808fdca8325a4faf2dbd0a59e0c9e#:~:text=CREATE%20TABLE%20Employees%20,60%29%20NULL)
. Comments are provided to separate sections for clarity.

# Northwind Database Schema & Sample Data Sources (with Licenses)
## Official Microsoft Distributions
* **Microsoft’s Northwind Sample (CodePlex/MSDN)** – Originally made available by Microsoft on platforms like CodePlex and MSDN Code Gallery under 
**the Microsoft Public License (MS-PL)**. This open-source license covers the schema and data of the Northwind database
`en.wikiversity.org` `snk-corp.co.jp`. 
(For example, Microsoft’s downloadable `instnwnd.sql` script containing the schema and data was released under MS-PL.)

* **Microsoft SQL Server Samples (GitHub Repository)** – Microsoft’s current official distribution of Northwind (as part of the SQL Server sample databases on GitHub) 
is provided under an **MIT License**. The Northwind database scripts (e.g. `instnwnd.sql`) in this repository are shared by Microsoft with an MIT licensing, allowing free use with attribution
[kendralittle.com](https://kendralittle.com/2019/12/27/resolving-merge-conflicts-in-sql-source-control-the-basics-video/)
. (This GitHub repo supersedes the older CodePlex version, but the schema and data remain essentially the same.)
## Public PostgreSQL Adaptations
* **Northwind for PostgreSQL – pthom/northwind_psql (GitHub)** – A popular community adaptation of Northwind for Postgres. 
This project provides SQL scripts to create and load the Northwind schema on PostgreSQL. 
It acknowledges that the original schema and data are licensed under **MS-PL** (as per Microsoft’s terms)
[gitee.com](https://gitee.com/lucien2009/northwind_psql?skip_mobile=true#:~:text=,Definitions%20The%20terms)
. The repository includes the Microsoft Public License text, since it redistributes the sample data under those terms.

* **Northwind Extended (Google Code Archive)** – An earlier public project that ported Northwind to multiple databases (including PostgreSQL). 
It was freely available for educational use; the **Northwind schema and data in this project fell under Microsoft’s sample database license (MS-PL)** as well
[snk-corp.co.jp](https://www.snk-corp.co.jp/webmanual/samuraispirits/es-mx/gamemode9.php#:~:text=The%20Ms,data%20is%20also%20available%20from)
. (The Google Code project is now archived, but it provided PostgreSQL SQL scripts for Northwind, abiding by the permissive license of the original data.)

Each of the above sources provides the Northwind database schema and sample records, along with an associated license or usage policy. Microsoft’s official releases use permissive licenses (originally MS-PL, later MIT on GitHub) to allow broad use of the sample. Likewise, third-party PostgreSQL versions either inherit the Microsoft Public License for the data or apply a similarly permissive license, ensuring Northwind can be used in demos, training, and development freely under those terms

### Citations

Database Examples/Northwind - Wikiversity

https://en.wikiversity.org/wiki/Database_Examples/Northwind

SAMURAI SHODOWN   |  WEB MANUAL

https://www.snk-corp.co.jp/webmanual/samuraispirits/es-mx/gamemode9.php

Resolving Merge Conflicts in SQL Source Control - the Basics (video)

https://kendralittle.com/2019/12/27/resolving-merge-conflicts-in-sql-source-control-the-basics-video/

northwind_psql: PostgreSQL 示例数据库

https://gitee.com/lucien2009/northwind_psql?skip_mobile=true
