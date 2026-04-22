# Connecting to InsightEd Database via R

This guide provides a step-by-step walkthrough for connecting to the InsightEd production database using R, with a focus on **Tidyverse** integration for seamless data analysis.

## 1. Prerequisites

You will need to install the following R packages:

```r
# Run this once to install the necessary libraries
install.packages(c("DBI", "RPostgres", "tidyverse", "dbplyr"))
```

*   **DBI**: The universal database interface for R.
*   **RPostgres**: The specific driver for PostgreSQL databases.
*   **tidyverse**: Includes `dplyr` for data manipulation.
*   **dbplyr**: Translates `dplyr` code into SQL automatically.

---

## 2. Secure Credential Management

To avoid hardcoding your password in scripts, we recommend using an `.Renviron` file.

1.  In your R console, run: `usethis::edit_r_environ()` (or create a file named `.Renviron` in your project root).
2.  Add the following line:
    ```text
    INSIGHTED_DB_PASS="pRZTbQ2T1JD7"
    ```
3.  Restart your R session for changes to take effect.

---

## 3. Connection Details

Use the following parameters to connect to the Azure PostgreSQL instance:

| Parameter | Value |
| :--- | :--- |
| **Host** | `stride-posgre-prod-01.postgres.database.azure.com` |
| **Database** | `insightEd` |
| **User** | `Administrator1` |
| **Port** | `5432` |
| **SSL Mode** | `require` |

---

## 4. Establishing the Connection

Copy and paste the following code into your R script to connect:

```r
library(DBI)
library(RPostgres)
library(tidyverse)
library(dbplyr)

# Establish connection
con <- dbConnect(
  RPostgres::Postgres(),
  host = "stride-posgre-prod-01.postgres.database.azure.com",
  port = 5432,
  dbname = "insightEd",
  user = "Administrator1",
  password = Sys.getenv("INSIGHTED_DB_PASS"),
  sslmode = "require"
)

# Check if connection is successful
dbListTables(con) %>% grep("esf7", ., value = TRUE)
```

---

## 5. Tidyverse Integration (dbplyr)

The `dbplyr` package allows you to work with database tables as if they were regular R data frames.

### Step 5.1: Link to the Table
Instead of downloading the whole table, we create a "lazy" reference.

```r
# Create a reference to the esf7_database table
esf7_db <- tbl(con, "esf7_database")
```

### Step 5.2: Querying with Dplyr
You can now use standard `dplyr` verbs. The code below is translated to SQL and executed on the server, not on your computer.

```r
# Example: Summary of accomplishment by Region
summary_data <- esf7_db %>%
  filter(!is.na(region)) %>%
  group_by(region) %>%
  summarize(
    avg_accomplishment = mean(accomplishment_percentage, na.rm = TRUE),
    total_projects = n()
  ) %>%
  arrange(desc(avg_accomplishment))

# View the generated SQL (optional)
show_query(summary_data)
```

### Step 5.3: Materializing Data
When you are ready to bring the results into your local R memory for plotting or local analysis, use `collect()`.

```r
# Pull data into your R environment as a local data frame
local_results <- summary_data %>% collect()

# Now you can use it for ggplot2
library(ggplot2)
ggplot(local_results, aes(x = reorder(region, avg_accomplishment), y = avg_accomplishment)) +
  geom_col(fill = "steelblue") +
  coord_flip() +
  labs(title = "Average Project Accomplishment by Region", x = "Region", y = "% Done")
```

---

## 6. Closing the Connection

Always close your connection when finished to free up server resources.

```r
dbDisconnect(con)
```

---

## Troubleshooting

*   **SSL Errors**: Ensure `sslmode = "require"` is set. Azure PostgreSQL does not allow unencrypted connections.
*   **Authentication Failed**: Double-check your `.Renviron` variable name and ensure there are no trailing spaces.
*   **Timeout**: Ensure your IP address is whitelisted in the Azure Portal firewall settings (if you are connecting from a new network).
