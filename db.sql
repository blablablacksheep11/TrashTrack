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
INSERT INTO `administrator` VALUES (1,'LARRY BILL','male','lamyongqin@gmail.com','016-3679616','Yongqin_1101'),(2,'JOHN HARRY','male','scpg2300128@segi4u.my','012-4047785','Yqlam@1101');
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
INSERT INTO `bin` VALUES (1,'A',29,'available',0);
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
INSERT INTO `bin_history` VALUES (1,1,84,'2025-04-11 22:11:36','unavailable',2,'2025-04-11 22:12:11'),(2,1,80,'2025-04-11 22:33:13','unavailable',2,'2025-04-11 22:33:35'),(3,1,85,'2025-04-15 09:44:13','unavailable',1,'2025-04-15 09:49:21'),(4,1,85,'2025-04-15 09:52:22','unavailable',2,'2025-04-15 09:54:20'),(5,1,85,'2025-04-15 20:58:31','unavailable',2,'2025-04-15 20:59:44'),(6,1,82,'2025-04-15 21:00:22','unavailable',1,'2025-04-15 21:00:45'),(7,1,86,'2025-04-15 21:01:27','unavailable',2,'2025-04-15 21:06:47'),(8,1,89,'2025-04-15 21:09:10','unavailable',2,'2025-04-15 21:11:23'),(9,1,87,'2025-04-15 21:11:58','unavailable',1,'2025-04-15 21:12:48'),(10,1,85,'2025-04-16 08:32:47','unavailable',2,'2025-04-16 08:33:39'),(11,1,86,'2025-04-16 08:36:30','unavailable',1,'2025-04-16 08:37:16'),(12,1,90,'2025-04-16 15:15:26','unavailable',1,'2025-04-16 15:15:45'),(13,1,83,'2025-04-20 10:16:27','unavailable',2,'2025-04-20 10:17:58');
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
INSERT INTO `cleaner` VALUES (1,'JOHN CARTER','male','010511-07-1459','john@gmail.com'),(2,'MARIA LOPEZ','male','041208-35-7415','maria@gmail.com');
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
