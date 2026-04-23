# School Head Data Dictionary
This document provides a comprehensive list of all data elements collected from School Heads across the User Profile and all functional modules (Units 1-10), along with their descriptions.

## Data Dictionary Table

| Module/Component | Data Element | Description |
| :--- | :--- | :--- |
| **User Profile** | `firstName` | School Head's first name |
| | `lastName` | School Head's last name |
| | `region`, `province`, `city`, `barangay` | Current assignment/address details of the School Head |
| **Unit 1: School Identity** | `school_id` | Unique identifier (ESF7 ID) for the school |
| | `school_name` | Official name of the school |
| | `region`, `province`, `municipality`, `barangay` | Address and geographic location of the school |
| | `division`, `district`, `leg_district` | DepEd organizational classification of the school |
| | `curricular_offering` | Educational levels offered (e.g., Purely Elementary, K-12) |
| | `latitude`, `longitude` | GPS coordinates of the main campus |
| | `iern` | Integrated Educational Routing Number (if applicable) |
| | `school_head` | Name of the assigned school head |
| | `contact_number` | School or school head's official contact number |
| | `ownership` | Private or public ownership classification |
| | `school_type` | Specific typology of the school (e.g., Mother, Annex, Extension) |
| | `mother_school_id` | Reference to the mother school if it is an annex |
| | `established_month`, `established_year` | Date when the school was officially established |
| | `head_first_name`, `head_middle_name`, `head_last_name` | Full name details of the registered school head |
| | `head_sex` | Gender of the school head |
| | `head_position_title` | Official designation (e.g., Principal I, TIC) |
| | `head_date_of_birth`, `head_date_hired` | Demographic and employment history of the school head |
| **Unit 2: Learners** | `kinderEnrollment` | Direct count of Kindergarten enrollees |
| | `orgType` | Organization format of the classes (Monograde, Multigrade, Mixed) |
| | `mgCombinations` | Configuration definitions mapping which grades are joined in multigrade |
| | `gradeTotals` | Aggregate enrollment numbers isolated per grade level |
| | `gradeAvailability` | Boolean toggles marking which specific grades are currently active |
| | `hasSnedSelfContained`, `sned_self_contained_count` | Boolean tracker and total head count for Non-Graded SNED learners |
| | `snedLanguage` | Primary instruction language utilized for the SNED program |
| | `hasAral` (Math/Reading/Science) | Boolean indicating participation in the National Learning Recovery Program (ARAL) |
| | `aral` (Math/Reading/Science) | Disaggregated enrollee counts per subject for the ARAL program |
| | `genderTotals` | Global aggregate of Male vs. Female enrollees across the school |
| **Unit 3: Organized Classes** | `sectionData` | Information on individual sections created per active grade |
| | `totalEnrollment` | Running sum verifying correct sectioning distribution |
| **Unit 4: Learner Profile** | `demographicsData` | IP (Indigenous Peoples), Muslim, 4Ps, and SPED learner breakdowns |
| | `hasMovement`, `movementData` | Trackers for transferees (In/Out), dropouts, and Balik-Aral students |
| | `bmiData` | Nutritional status aggregates (Severely Wasted, Wasted, Normal, Overweight, Obese) |
| **Unit 5: Shifting Modality** | `hasStandardShifting`, `mapData` | Data detailing double/triple shifting schedules to optimize facility usage |
| | `hasAdms`, `admData` | Trackers for Alternative Delivery Modes (e.g., Modular, Online, Blended) |
| **Unit 6: Teaching Personnel** | `first_name`, `last_name` | Full name of the instructional staff |
| | `position` | Official teaching designation (e.g., Teacher I, Master Teacher II) |
| | `specialization` | Academic focus or subject area expertise |
| | `funding_source` | Entity providing the teacher's salary (e.g., National, SEF, LGU) |
| | `role_designation` | Positional role (e.g., Class Adviser, Non-Advisory) |
| | `monday_mins`...`friday_mins` | Aggregate daily instruction time in minutes |
| | `workloads` | Detailed list mapping Grade Level, Subject, and Duration per assignment |
| **Unit 7: School Resources** | `gradesData` | Enrollment limits and requirements mapped to available resources |
| | `generalRoomsData` | Inventory of standard classrooms available for instruction |
| | `ictData` | Inventories covering computers, projectors, internet connectivity |
| | `hasEcart`, `eCarts` | Boolean toggle and counts for mobile electronic carts / tech hubs |
| | `washData` | Inventories for toilets, handwashing facilities, and drinking water sources |
| | `utilitiesData` | Electricity sources and general utility service details |
| **Unit 8: Physical Facilities** | `buildingTypes`, `buildings` | Structural registry detailing specific building models and counts |
| | `roomsData`, `spaces` | Internal dimension mappings and specific room designations within buildings |
| | `repairAssessments` | Safety and dilapidation metrics cataloging needed major/minor repairs |
| **Unit 9: School Location** | `transportation_modes` | Modes used to reach the school (Walking, Boat, Habal-habal, etc.) |
| | `road_paved_pct`, `road_lighting_pct` | Infrastructure quality metrics for access roads |
| | `public_transpo_availability` | Frequency of public vehicle passage (Scale 1-5) |
| | `near_cliff_ravine`, `road_cliff_pct` | Geographic safety factors for mountainous routes |
| | `near_water`, `water_proximity` | Proximity to rivers, lakes, or seas and distance measurements |
| | `hazards_experienced` | specific trail hazards (Snake bites, Leeches, Flash floods) |
| | `river_crossing_count` | Number of rivers that must be traversed on foot |
| | `points_of_reference` | Time/Distance to Hospital, Bgy Hall, SDO, and Highway |
| | `cellular_coverage` | Quality of network signal (None to Strong) |
| | `natural_calamities` | History of Typhoons, Floods, Earthquakes (Incidence count) |
| | `anthropogenic_threats` | Conflicts or civil unrest history in the vicinity |
| | `road_passable_pct` | Percentage of route accessible by public transport |
| **Unit 10: Verification** | `remarks` | Final attestations and contextual notes appended by the school head |
| | `stats` | Aggregate summary statistics to be approved prior to submission |

## Engineer Data Dictionary

This section covers data elements specifically collected for and from Engineers, referencing both frontend React forms and Azure backend tables (`engineer_form`, `engineer_image`).

### 1. Project Management (Engineer Form)

| Source | Data Element | Description |
| :--- | :--- | :--- |
| Azure DB | `project_id` | Unique sequential identifier for an infrastructure project |
| Azure DB | `project_name` | Official title or scope of the project |
| Azure DB | `school_id`, `school_name` | Target school location for the project |
| Azure DB | `status` | Current standing (e.g., Ongoing, Completed, Not Started) |
| Azure DB | `accomplishment_percentage` | Progress metric of project completion (0-100) |
| Azure DB | `status_as_of` | Timestamp marking the last progress update |
| Azure DB | `target_completion_date` | Expected date of project turnover |
| Azure DB | `actual_completion_date` | Real date of project turnover |
| Azure DB | `notice_to_proceed` | Date authorization was given to start construction |
| Azure DB | `contractor_name` | Entity carrying out the construction |
| Azure DB | `approved_budget_for_contract` | Planned fiscal allocation for the project |
| Azure DB | `contract_amount` | The actual monetary value of the awarded contract |
| Azure DB | `batch_of_funds`, `funding_year` | Capital sourcing and timeline context |
| Azure DB | `is_donated` | Flag indicating if the project was a third-party donation |
| Azure DB | `ipc` | Inventory/Internal tracking reference code |
| Azure DB | `latitude`, `longitude` | Geolocation coordinates for the specific project site |
| Azure DB | `engineer_name` | Name of the supervising engineer |
| Azure DB | `uploader_type` | System classification (EFD, Division Engineer, Non-DepEd) |
| Azure DB | `validated_by` | Individual who authenticated the project listing |

### 2. Infrastructure & Resources (Engineer Forms)

| Source | Data Element | Description |
| :--- | :--- | :--- |
| UI Form | `buildingName` | Naming or identification number of monitored buildings |
| UI Form | `constructionYear` | Baseline chronological data (Year Built) |
| UI Form | `totalClassrooms`, `condition` | Room count and structural integrity rating |
| UI Form | `hasElectricity`, `hasWater` | Utility availability checkboxes for structural audits |
| UI Form | `ResourceType` | Analyzed utility (Electricity, Water Supply, Internet, Solar) |
| UI Form | `Status`, `ProviderName` | Operational status (Functional, Intermittent, Not Working) and provider |
| UI Form | `AvgMonthlyCost` | Financial metric estimating utility spend |
| Azure DB | `image_data`, `category` | Base64 encoded payload and classification (Internal, External, Defect) |
