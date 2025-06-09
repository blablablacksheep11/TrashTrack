-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: bin
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `administrator`
--

-- DROP TABLE IF EXISTS `administrator`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `administrator` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `gender` varchar(45) NOT NULL,
  `email` varchar(255) NOT NULL,
  `contact` varchar(45) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administrator`
--

-- LOCK TABLES `administrator` WRITE;
/*!40000 ALTER TABLE `administrator` DISABLE KEYS */;
/*!40000 ALTER TABLE `administrator` ENABLE KEYS */;
-- UNLOCK TABLES;

--
-- Table structure for table `bin`
--

-- DROP TABLE IF EXISTS `bin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bin` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `block` varchar(45) NOT NULL,
  `level` int NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT 'available',
  `accumulation` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bin`
--

-- LOCK TABLES `bin` WRITE;
/*!40000 ALTER TABLE `bin` DISABLE KEYS */;
/*!40000 ALTER TABLE `bin` ENABLE KEYS */;
-- UNLOCK TABLES;

--
-- Table structure for table `bin_history`
--

-- DROP TABLE IF EXISTS `bin_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bin_history` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `binID` int NOT NULL,
  `accumulation` int NOT NULL,
  `creation` datetime NOT NULL,
  `status` varchar(45) NOT NULL DEFAULT 'uncollected',
  `collectorID` int DEFAULT NULL,
  `collection` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bin_history`
--

-- LOCK TABLES `bin_history` WRITE;
/*!40000 ALTER TABLE `bin_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `bin_history` ENABLE KEYS */;
-- UNLOCK TABLES;

--
-- Table structure for table `cleaner`
--

-- DROP TABLE IF EXISTS `cleaner`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cleaner` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `gender` varchar(45) NOT NULL DEFAULT 'male',
  `IC` varchar(45) NOT NULL,
  `email` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cleaner`
--

-- LOCK TABLES `cleaner` WRITE;
/*!40000 ALTER TABLE `cleaner` DISABLE KEYS */;
/*!40000 ALTER TABLE `cleaner` ENABLE KEYS */;
-- UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-04-22 10:02:04
